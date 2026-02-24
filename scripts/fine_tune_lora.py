"""
InterviewAI Pro — LoRA Fine-Tuning Script (Unsloth)
====================================================

This script performs TRUE fine-tuning: it updates the qwen3:8b model weights
using LoRA (Low-Rank Adaptation) on your collected interview evaluation data.
The result is a GGUF file you can register with Ollama.

This is how production ML companies do it:
  1. Collect data  (your system does this automatically via interviews + datasets)
  2. Export JSONL  (admin panel → "Export Training Data" button)
  3. Fine-tune     (this script)
  4. Register      (admin panel → "Register Trained Model" button, or CLI below)

The difference from the admin panel's "Calibrate Model" button:
  - "Calibrate Model"   → In-context learning (same weights, examples in system prompt)
  - This script         → True LoRA fine-tuning (weights actually change)

Hardware requirements:
  - GPU with at least 6GB VRAM (RTX 4070 8GB ✓)
  - ~8 GB free RAM
  - ~15 GB free disk space

Installation (one-time):
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install --no-deps trl peft accelerate bitsandbytes datasets

Usage:
  python scripts/fine_tune_lora.py --jsonl path/to/interviewai_training_XXXX.jsonl

  Optional flags:
    --output-dir   ./output/interviewai-qwen3-8b   Where to save the model
    --base-model   unsloth/Qwen3-8B-bnb-4bit       Unsloth-optimised base
    --epochs       3
    --batch-size   2
    --lora-r       16

After training completes, register with Ollama:
  ollama create interviewai-qwen3-8b -f output/interviewai-qwen3-8b/Modelfile

Or use the admin panel → "Register Trained Model" button and paste the GGUF path.
"""

import argparse
import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
def parse_args():
    parser = argparse.ArgumentParser(
        description="LoRA fine-tune qwen3:8b on InterviewAI Pro training data"
    )
    parser.add_argument(
        "--jsonl",
        required=True,
        help="Path to the JSONL file exported from the admin panel",
    )
    parser.add_argument(
        "--output-dir",
        default="./output/interviewai-qwen3-8b",
        help="Directory to save the trained model and GGUF",
    )
    parser.add_argument(
        "--base-model",
        default="unsloth/Qwen3-8B-bnb-4bit",
        help="Unsloth-optimised base model identifier",
    )
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--max-seq-len", type=int, default=4096)
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Load and validate JSONL dataset
# ---------------------------------------------------------------------------
def load_dataset(jsonl_path: str):
    path = Path(jsonl_path)
    if not path.exists():
        print(f"[ERROR] File not found: {jsonl_path}")
        sys.exit(1)

    records = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if "messages" not in obj:
                    print(f"[WARN] Line {i} missing 'messages' field — skipping")
                    continue
                records.append(obj)
            except json.JSONDecodeError as e:
                print(f"[WARN] Line {i} invalid JSON ({e}) — skipping")

    print(f"[INFO] Loaded {len(records)} training examples from {jsonl_path}")

    if len(records) < 5:
        print(
            f"[ERROR] Only {len(records)} valid examples found. "
            "You need at least 5. Conduct more interviews or upload datasets "
            "via the admin panel, then re-export."
        )
        sys.exit(1)

    return records


# ---------------------------------------------------------------------------
# Main fine-tuning routine
# ---------------------------------------------------------------------------
def main():
    args = parse_args()

    # --- Import Unsloth (fail fast with helpful message) ---
    try:
        from unsloth import FastLanguageModel
        from unsloth.chat_templates import get_chat_template
    except ImportError:
        print(
            "\n[ERROR] Unsloth is not installed.\n"
            "Run:  pip install 'unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git'\n"
            "      pip install --no-deps trl peft accelerate bitsandbytes datasets\n"
        )
        sys.exit(1)

    try:
        from trl import SFTTrainer, SFTConfig
        from datasets import Dataset
        import torch
    except ImportError:
        print(
            "\n[ERROR] trl / datasets / torch not installed.\n"
            "Run:  pip install --no-deps trl peft accelerate bitsandbytes datasets\n"
        )
        sys.exit(1)

    # --- Load training data ---
    records = load_dataset(args.jsonl)

    # --- Load base model with 4-bit quantisation ---
    print(f"\n[INFO] Loading base model: {args.base_model}")
    print("[INFO] Using 4-bit quantisation — requires ~6 GB VRAM")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_len,
        dtype=None,           # auto-detect (float16 on modern NVIDIA)
        load_in_4bit=True,
    )

    tokenizer = get_chat_template(tokenizer, chat_template="qwen-2.5")

    # --- Add LoRA adapters ---
    # r=16, alpha=32: good balance of expressiveness vs. memory for 8B models.
    # target_modules covers all attention + FFN projection layers in Qwen3.
    print(f"\n[INFO] Attaching LoRA adapters (r={args.lora_r}, alpha={args.lora_r * 2})")

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=args.lora_r * 2,
        lora_dropout=0.0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
        use_rslora=False,
        loftq_config=None,
    )

    # --- Format dataset using chat template ---
    def format_example(record):
        msgs = record["messages"]
        text = tokenizer.apply_chat_template(
            msgs,
            tokenize=False,
            add_generation_prompt=False,
        )
        return {"text": text}

    formatted = [format_example(r) for r in records]
    dataset = Dataset.from_list(formatted)

    # --- Training configuration ---
    # gradient_accumulation_steps compensates for small batch size on 8 GB VRAM.
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = SFTConfig(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        warmup_steps=5,
        save_steps=50,
        save_total_limit=2,
        dataset_text_field="text",
        max_seq_length=args.max_seq_len,
        packing=False,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=training_args,
    )

    print(f"\n[INFO] Starting LoRA fine-tuning on {len(records)} examples")
    print(f"[INFO] Epochs: {args.epochs}  |  Batch size: {args.batch_size}  |  LR: 2e-4")
    print("[INFO] This will take 30–90 minutes on an RTX 4070 8 GB\n")

    trainer.train()

    # --- Save LoRA adapter ---
    adapter_path = output_dir / "lora_adapter"
    model.save_pretrained(str(adapter_path))
    tokenizer.save_pretrained(str(adapter_path))
    print(f"\n[INFO] LoRA adapter saved to: {adapter_path}")

    # --- Export merged model to GGUF (Q4_K_M quantisation) ---
    # Q4_K_M gives the best accuracy / size trade-off for 8B models.
    gguf_path = output_dir / "interviewai-qwen3-8b-Q4_K_M.gguf"
    print(f"\n[INFO] Exporting merged GGUF to: {gguf_path}")
    print("[INFO] Q4_K_M quantisation — ~4.8 GB output file")

    model.save_pretrained_gguf(
        str(output_dir),
        tokenizer,
        quantization_method="q4_k_m",
    )

    # --- Write Modelfile for Ollama ---
    modelfile_content = f"""FROM {gguf_path}

PARAMETER temperature 0.45
PARAMETER repeat_penalty 1.1
PARAMETER num_ctx 16384
PARAMETER top_p 0.9
"""
    modelfile_path = output_dir / "Modelfile"
    modelfile_path.write_text(modelfile_content)

    # --- Print final instructions ---
    print("\n" + "=" * 60)
    print("  LoRA fine-tuning complete!")
    print("=" * 60)
    print(f"\n  GGUF file   : {gguf_path}")
    print(f"  Modelfile   : {modelfile_path}")
    print("\n  Register with Ollama (CLI):")
    print(f"    ollama create interviewai-qwen3-8b -f \"{modelfile_path}\"")
    print("\n  OR use the admin panel:")
    print("    System Admin → Model Fine-Tuning → Register Trained Model")
    print(f"    Paste this path: {gguf_path}")
    print("\n  Once registered, your system will automatically prefer")
    print("  interviewai-qwen3-8b for all interview evaluations.")
    print("  Fallback chain: interviewai-qwen3-8b → qwen3:8b → qwen2.5:7b-instruct")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
