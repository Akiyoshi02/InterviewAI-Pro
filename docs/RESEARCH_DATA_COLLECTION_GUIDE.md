# Research Data Collection Guide

## Complete Guide for LLM and MediaPipe Data Collection

This document provides a comprehensive guide for collecting training data from multiple sources as required for the research project.

---

## Part 1: LLM Interview Dialogue Data Collection

### Overview
To train an LLM for interview-style dialogue, we need diverse conversational data from multiple sources:
1. **External Datasets** - Pre-existing interview datasets from the internet
2. **Web Sources** - Gather interview examples from websites
3. **Our System** - Auto-collected data from actual interview sessions
4. **Synthetic Data** - Generate interview dialogues using LLMs

---

### Source 1: External Datasets (Ready to Use)

#### Hugging Face Datasets

| Dataset | Description | Size | Link |
|---------|-------------|------|------|
| **Anthropic/AnthropicInterviewer** | ~1,250 interview transcripts (workforce, creatives, scientists) | 4.8k-26.8k chars each | https://huggingface.co/datasets/Anthropic/AnthropicInterviewer |
| **ali-alkhars/interviews** | 2,290 interview Q&A pairs (Angular, TypeScript, software roles) | 2,290 rows | https://huggingface.co/datasets/ali-alkhars/interviews |
| **HR-MultiWOZ** | Task-oriented HR dialogue dataset | Large | https://amazon.science/code-and-datasets/hr-multiwoz |

#### Kaggle Datasets

| Dataset | Description | Size | Link |
|---------|-------------|------|------|
| **Software Engineering Interview Questions** | 250 questions with answers (algorithms, system design, ML) | 250 Q&A | https://kaggle.com/datasets/syedmharis/software-engineering-interview-questions-dataset |
| **Coding Questions with Solutions** | Python interview problems with solutions | 5,000+ | https://kaggle.com/datasets/thedevastator/coding-questions-with-solutions |

#### How to Download

**From Hugging Face:**
```python
from datasets import load_dataset

# Anthropic Interview Dataset
dataset = load_dataset("Anthropic/AnthropicInterviewer")
print(dataset)

# Ali-alkhars Interviews
dataset = load_dataset("ali-alkhars/interviews")
print(dataset)
```

**From Kaggle:**
1. Create account at kaggle.com
2. Go to dataset page
3. Click "Download" button
4. Extract CSV/JSON files

---

### Source 2: Web Sources for Interview Data

#### Websites with Interview Q&A

| Website | Type of Content | How to Use |
|---------|-----------------|------------|
| **Glassdoor.com** | Real interview questions by company | Search company → Interviews tab |
| **Indeed.com** | Interview questions by job title | Search job → Interview Questions |
| **InterviewBit.com** | Technical interview Q&A | Browse by topic |
| **LeetCode.com** | Coding interview problems | Discussions section |
| **GeeksforGeeks.org** | Technical Q&A with explanations | Interview corner |
| **Blind (TeamBlind.com)** | Real interview experiences | Search by company |

#### Manual Collection Process
1. Visit the website
2. Search for relevant job roles (e.g., "Software Engineer interview")
3. Copy questions and answers
4. Save in structured format (see below)

---

### Data Format for All Sources

Save all collected data in this standardized JSON format:

```json
{
  "source": "glassdoor",
  "collection_date": "2026-01-28",
  "job_role": "Software Engineer",
  "industry": "Technology",
  "experience_level": "mid",
  "conversation": [
    {
      "role": "interviewer",
      "content": "Tell me about a time you faced a challenging technical problem."
    },
    {
      "role": "candidate",
      "content": "In my previous role, we faced a database scaling issue..."
    },
    {
      "role": "interviewer", 
      "content": "How did you approach solving it?"
    },
    {
      "role": "candidate",
      "content": "First, I analyzed the query patterns using our monitoring tools..."
    }
  ],
  "metadata": {
    "company": "Google",
    "interview_type": "behavioral",
    "quality_rating": 4
  }
}
```

---

### Source 3: Synthetic Data Generation

Use LLMs to generate additional training data:

```python
# Using Ollama (local) or OpenAI API
prompt = """
Generate a realistic job interview conversation for a {job_role} position.
Include:
- 5-7 interview questions (mix of behavioral and technical)
- Realistic candidate responses
- Follow-up questions from the interviewer

Format as a dialogue between INTERVIEWER and CANDIDATE.
"""
```

---

## Part 2: MediaPipe Video Data Collection

### Overview
To create a proper reference data library, you need:
1. **Reference Videos** - Record examples of correct posture/gestures
2. **Counter-Examples** - Record examples of incorrect posture/gestures
3. **Analysis** - Run MediaPipe on videos to extract numerical values
4. **Documentation** - Document what makes posture "correct" vs "incorrect"

---

### Video Recording Protocol

#### Equipment Needed
- Webcam or smartphone camera (720p minimum, 1080p preferred)
- Good lighting (face clearly visible)
- Plain background
- Stable camera position (tripod or fixed mount)

#### Recording Environment
- Camera at eye level
- Distance: 50-80cm from camera
- Lighting from front (no backlighting)
- Neutral background (no distractions)

---

### Posture Categories to Record

#### Category 1: Upper Body Posture

| Good Posture | Bad Posture |
|--------------|-------------|
| Shoulders level | One shoulder higher |
| Back straight | Slouching forward |
| Centered in frame | Leaning to one side |
| Natural position | Tense/stiff |

**Recording Instructions:**
1. Record 30-60 seconds of GOOD posture (sitting straight, shoulders level)
2. Record 30-60 seconds of BAD posture (slouching, uneven shoulders)
3. Label files clearly: `posture_good_01.mp4`, `posture_bad_slouch_01.mp4`

#### Category 2: Head Position

| Good Position | Bad Position |
|---------------|--------------|
| Looking at camera | Looking down |
| Level head | Head tilted |
| Centered | Turned away |

**Recording Instructions:**
1. Record GOOD: Looking directly at camera, head level
2. Record BAD: Head tilted, looking down, looking away
3. Labels: `head_good_01.mp4`, `head_bad_tilted_01.mp4`

#### Category 3: Eye Contact

| Good Eye Contact | Poor Eye Contact |
|------------------|------------------|
| Looking at camera | Looking away frequently |
| Natural blinking | Eyes closed/drowsy |
| Engaged expression | Distracted |

**Recording Instructions:**
1. Record GOOD: Maintaining camera eye contact while speaking
2. Record BAD: Looking around, avoiding camera, excessive blinking
3. Labels: `eyes_good_contact_01.mp4`, `eyes_bad_avoiding_01.mp4`

#### Category 4: Hand Movements

| Appropriate | Inappropriate |
|-------------|---------------|
| Hands visible, calm | Fidgeting constantly |
| Natural gestures | Touching face repeatedly |
| Hands folded/relaxed | Drumming/tapping |

**Recording Instructions:**
1. Record GOOD: Hands visible, occasional natural gestures
2. Record BAD: Fidgeting, touching face, nervous movements
3. Labels: `hands_good_calm_01.mp4`, `hands_bad_fidgeting_01.mp4`

#### Category 5: Facial Expressions

| Professional | Unprofessional |
|--------------|----------------|
| Neutral/pleasant | Frowning |
| Natural smile | Forced/fake smile |
| Engaged | Bored/disinterested |

---

### Video File Naming Convention

```
{category}_{quality}_{description}_{number}.mp4

Examples:
- posture_good_straight_01.mp4
- posture_bad_slouching_01.mp4
- head_good_level_01.mp4
- head_bad_tilted_left_01.mp4
- eyes_good_contact_01.mp4
- eyes_bad_looking_down_01.mp4
- hands_good_calm_01.mp4
- hands_bad_fidgeting_01.mp4
```

---

### Folder Structure for Video Library

```
research-data/
├── videos/
│   ├── posture/
│   │   ├── good/
│   │   │   ├── posture_good_straight_01.mp4
│   │   │   └── posture_good_straight_02.mp4
│   │   └── bad/
│   │       ├── posture_bad_slouching_01.mp4
│   │       └── posture_bad_leaning_01.mp4
│   ├── head_position/
│   │   ├── good/
│   │   └── bad/
│   ├── eye_contact/
│   │   ├── good/
│   │   └── bad/
│   ├── hand_movement/
│   │   ├── good/
│   │   └── bad/
│   └── facial_expression/
│       ├── good/
│       └── bad/
├── analysis_results/
│   └── (MediaPipe output JSON files)
└── metadata/
    └── video_labels.json
```

---

### Minimum Video Requirements

| Category | Good Examples | Bad Examples | Total |
|----------|---------------|--------------|-------|
| Posture | 5 videos | 5 videos | 10 |
| Head Position | 3 videos | 3 videos | 6 |
| Eye Contact | 3 videos | 3 videos | 6 |
| Hand Movement | 3 videos | 3 videos | 6 |
| Facial Expression | 3 videos | 3 videos | 6 |
| **Total** | **17 videos** | **17 videos** | **34** |

Each video: 30-60 seconds
Total recording time: ~17-34 minutes

---

## Part 3: Analysis Tools

We have created tools in the system to:
1. **Record reference videos** directly from the application
2. **Analyze videos** using MediaPipe and extract metrics
3. **Compare** good vs bad posture metrics
4. **Generate reference values** based on analyzed videos

See the tools at:
- `src/pages/research-tools/VideoRecorder.jsx`
- `src/pages/research-tools/VideoAnalyzer.jsx`
- `src/services/videoAnalysisService.js`

---

## Summary Checklist

### LLM Data Collection
- [ ] Download Anthropic/AnthropicInterviewer dataset from Hugging Face
- [ ] Download ali-alkhars/interviews dataset from Hugging Face
- [ ] Download Kaggle interview datasets
- [ ] Manually collect 50+ Q&A pairs from Glassdoor/Indeed
- [ ] Generate synthetic interview data using LLMs
- [ ] Format all data in standardized JSON
- [ ] Use Data Aggregation Tool to combine sources

### MediaPipe Video Collection
- [ ] Set up recording environment (lighting, camera, background)
- [ ] Record 17+ "good" example videos across all categories
- [ ] Record 17+ "bad" example videos across all categories
- [ ] Organize videos in folder structure
- [ ] Run Video Analyzer tool on all videos
- [ ] Generate reference values from analysis
- [ ] Document findings

---

## Next Steps

1. Start with the easiest sources (downloading existing datasets)
2. Collect Q&A pairs from websites (Glassdoor, Indeed, etc.)
3. Generate synthetic data using LLMs if needed
4. Record your own reference videos for MediaPipe
5. Use the analysis tools to process videos
6. Compile all data for training
