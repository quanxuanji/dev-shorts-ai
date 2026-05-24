# DevShorts AI

DevShorts AI is an open-source voiceover script and AI audio generator for short-video makers. It targets programmers and AI builders who want to turn source videos, local clips, or topic notes into rewritten short-video scripts, FishSpeech-compatible narration audio, subtitles, and a rendered `final.mp4`.

The current MVP is a local-first product slice: it can run with lightweight fallbacks, but the main path is a `semi_real` task that accepts a URL or local file, extracts or drafts script content, rewrites it for a target short-video style, generates `voice.wav` through edge-tts or a FishSpeech-compatible service, and renders a preview video with subtitles.

## Stack

- Frontend: Next.js, TypeScript, TailwindCSS, shadcn-style UI primitives
- Backend: FastAPI, Python
- Task queue: in-memory task store, designed to swap to Redis/Celery
- AI providers: fallback provider now, OpenAI-compatible and Ollama adapter paths
- Media providers: ffmpeg adapters plus fallback/edge-tts/FishSpeech seams for TTS, yt-dlp, and Whisper/faster-whisper

## Quick Start

```bash
cp .env.example .env
npm install
python -m venv apps/api/.venv
apps/api/.venv/Scripts/Activate.ps1
pip install -r apps/api/requirements.txt
```

Start the API:

```bash
npm run dev:api
```

Start the web app in another terminal:

```bash
npm run dev:web
```

Open:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Optional Local Tools

The app works without these tools by logging fallbacks and keeping tasks inspectable. Install them when testing the local voiceover pipeline:

- `ffmpeg` for audio extraction and render probing.
- `yt-dlp` for downloading source videos from URLs.
- `whisper` or `faster-whisper` for local ASR.
- `edge-tts` for quick local voice synthesis.
- FishSpeech-compatible HTTP service for local neural TTS.

If a dependency or provider is missing, DevShorts AI should fall back gracefully to placeholder artifacts and clear task logs instead of crashing the run.

Install Whisper CLI for real ASR:

```bash
pip install -r apps/api/requirements-asr.txt
```

Then set `ASR_PROVIDER=whisper_cli` from Settings or `.env`. The first run downloads the selected Whisper model weights, so `tiny` is recommended for a fast smoke test and `base` or above for better quality.

### TTS Providers

The MVP supports three TTS modes through `.env`:

- `TTS_PROVIDER=mock`: writes a silent fallback `voice.wav`, useful for smoke tests when no TTS engine is available.
- `TTS_PROVIDER=edge_tts`: generates a real voice with `edge-tts`, then converts it to `voice.wav` through ffmpeg.
- `TTS_PROVIDER=fishspeech`: calls the official FishSpeech local API endpoint, defaulting to `http://127.0.0.1:8080/v1/tts`.

FishSpeech is wired as an adapter, not bundled as a heavy model runtime. Start your FishSpeech service separately, then set:

```bash
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_VOICE=default
```

## Product Flow

Open Studio, enter a video URL or local file path, create a task, and watch the pipeline advance:

Source video/topic -> transcript or draft -> short-video script -> FishSpeech/edge-tts voice -> subtitles -> final.mp4

Task creation supports two modes:

- `mock`: deterministic in-memory progress and placeholder artifacts for fast UI/API smoke tests.
- `semi_real`: attempts local adapters where available, with logged fallbacks for missing providers.

Semi-real tasks also write:

- `transcript_segments.json` when Whisper/faster-whisper returns timing segments.
- `title_cover.json` with title variants, hashtags, and cover prompts.

Settings can also be edited from the web UI. The API persists runtime provider configuration to:

```text
apps/api/artifacts/runtime-settings.json
```

New `semi_real` tasks read this runtime config immediately, so you can switch `mock`, `whisper_cli`, `edge_tts`, `fishspeech`, `openai`, or `ollama` without restarting the UI.

Example API payload:

```json
{
  "source_url": "https://example.com/video",
  "local_file_path": null,
  "title": "DevShorts AI voiceover run",
  "mode": "semi_real",
  "topic": "open-source AI video workflows",
  "speaking_style": "technical"
}
```

## Project Layout

```text
apps/
  web/      Next.js control console
  api/      FastAPI workflow API
packages/
  shared/   Shared TypeScript contracts
docs/
  ARCHITECTURE.md
  ROADMAP.md
  API.md
```

## Development Notes

- Heavy model inference is not bundled in this MVP.
- Every workflow service has a dedicated module for future replacement.
- The API keeps tasks in memory. Restarting the API clears task history.
- Generated artifacts are represented in the task `artifacts` map until durable storage is added.
- Generated media artifacts and runtime settings are ignored by git.
