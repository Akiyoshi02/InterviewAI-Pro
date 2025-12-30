"""
Local Whisper Transcription Server
Runs faster-whisper on GPU for free, unlimited transcription
"""

import os
import sys
import site

# Add CUDA library paths to system PATH
def setup_cuda_paths():
    """Add CUDA DLL paths from pip packages to PATH"""
    site_packages = site.getsitepackages()
    for sp in site_packages:
        # Add nvidia packages to PATH
        nvidia_dirs = [
            os.path.join(sp, 'nvidia', 'cublas', 'bin'),
            os.path.join(sp, 'nvidia', 'cudnn', 'bin'),
            os.path.join(sp, 'nvidia', 'cuda_runtime', 'bin'),
        ]
        for nv_dir in nvidia_dirs:
            if os.path.exists(nv_dir):
                os.environ['PATH'] = nv_dir + os.pathsep + os.environ.get('PATH', '')
                print(f"Added to PATH: {nv_dir}")

setup_cuda_paths()

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import logging

app = Flask(__name__)
# Enable CORS for all origins (development mode)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["*"]
    }
})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_MODEL = "large-v3"
env_model = os.getenv("WHISPER_MODEL", "").strip()
MODEL_SIZE = env_model or DEFAULT_MODEL
DEVICE = "cuda"
COMPUTE_TYPE = "float16"

if env_model:
    logger.info("Loading Whisper model from WHISPER_MODEL env: %s", MODEL_SIZE)
else:
    logger.warning(
        "WHISPER_MODEL env var is missing; using default model '%s'.",
        DEFAULT_MODEL,
    )
    logger.info("Loading Whisper model: %s", MODEL_SIZE)
try:
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info(f"✓ Whisper model loaded on {DEVICE}")
except Exception as e:
    logger.error(f"Failed to load model on GPU, falling back to CPU: {e}")
    DEVICE = "cpu"
    COMPUTE_TYPE = "int8"
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info(f"✓ Whisper model loaded on {DEVICE}")

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check endpoint"""
    logger.info("Health check requested")
    response = jsonify({
        'status': 'healthy',
        'model': MODEL_SIZE,
        'device': DEVICE,
        'compute_type': COMPUTE_TYPE
    })
    return response

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file to text
    Expects: multipart/form-data with 'audio' field
    Returns: { text: string, language: string, segments: array }
    """
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        filename = audio_file.filename or ''
        _, ext = os.path.splitext(filename)
        suffix = ext if ext else '.webm'
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name
        
        logger.info(f"Transcribing audio file: {temp_path}")

        language = request.form.get('language', '').strip().lower()
        if not language:
            language = 'en'
        if language == 'auto':
            language = None

        task = request.form.get('task', '').strip().lower()
        if task not in ('transcribe', 'translate'):
            task = 'transcribe'
        
        # Transcribe with faster-whisper (optimized for accuracy)
        segments, info = model.transcribe(
            temp_path,
            language=language,  # Default to English unless specified
            task=task,
            beam_size=5,  # Higher beam search for better accuracy
            best_of=5,  # More candidates for better quality
            vad_filter=True,  # Voice Activity Detection (removes silence)
            vad_parameters=dict(min_silence_duration_ms=300),  # More aggressive silence removal
            temperature=0.0,  # Deterministic output
            condition_on_previous_text=True  # Use context for better accuracy
        )
        
        # Collect segments
        transcription_segments = []
        full_text = ""
        
        for segment in segments:
            segment_data = {
                'start': segment.start,
                'end': segment.end,
                'text': segment.text,
                'confidence': segment.avg_logprob
            }
            transcription_segments.append(segment_data)
            full_text += segment.text + " "
        
        full_text = full_text.strip()
        
        logger.info(f"Transcription complete: {len(full_text)} characters")
        
        # Clean up temp file
        os.unlink(temp_path)
        
        # Return result
        return jsonify({
            'success': True,
            'text': full_text,
            'language': info.language,
            'language_probability': info.language_probability,
            'duration': info.duration,
            'segments': transcription_segments
        })
    
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available Whisper models"""
    models = {
        'tiny': {'size': '39 MB', 'speed': 'Fastest', 'quality': 'Basic'},
        'base': {'size': '74 MB', 'speed': 'Very Fast', 'quality': 'Good'},
        'small': {'size': '244 MB', 'speed': 'Fast', 'quality': 'Very Good'},
        'medium': {'size': '769 MB', 'speed': 'Moderate', 'quality': 'Excellent'},
        'large-v3': {'size': '1550 MB', 'speed': 'Slower', 'quality': 'Best'}
    }
    return jsonify({
        'current_model': MODEL_SIZE,
        'available_models': models,
        'device': DEVICE
    })

if __name__ == '__main__':
    port = int(os.getenv('WHISPER_PORT', 5000))
    logger.info(f"Starting Whisper server on port {port}")
    logger.info(f"Model: {MODEL_SIZE} | Device: {DEVICE} | Compute: {COMPUTE_TYPE}")
    try:
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        import traceback
        traceback.print_exc()

