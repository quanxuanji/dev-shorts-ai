# DevShorts AI

DevShorts AI is an open-source MVP skeleton for an AI short-video workflow studio. It targets developers and AI builders who want a demoable pipeline for script extraction, AI rewriting, TTS, digital human generation, B-roll/rendering, and publishing automation.

The current third-phase MVP is semi-real: it still runs without heavy local media tooling, but the API and UI now expose the task shape needed for local file input, topics, speaking style, artifacts, and future real adapters.

## Stack

- Frontend: Next.js, TypeScript, TailwindCSS, shadcn-style UI primitives
- Backend: FastAPI, Python
- Task queue: in-memory task store, designed to swap to Redis/Celery
- AI providers: mock provider now, OpenAI/Ollama placeholders
- Media providers: ffmpeg semi-real adapters plus mock/edge-tts/FishSpeech seams for TTS, yt-dlp, Whisper/faster-whisper, digital human, B-roll, and platform publishing

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

The app works without these tools. Install them only when testing semi-real media adapters:

- `ffmpeg` for audio extraction and render probing.
- `yt-dlp` for downloading source videos from URLs.
- `whisper` or `faster-whisper` for local ASR.
- `edge-tts` for quick local voice synthesis.
- FishSpeech-compatible HTTP service for local neural TTS.

If a semi-real dependency or provider is missing, DevShorts AI should fall back gracefully to mock artifacts and keep the task inspectable instead of failing the whole demo.

Install Whisper CLI for real ASR:

```bash
pip install -r apps/api/requirements-asr.txt
```

Then set `ASR_PROVIDER=whisper_cli` from Settings or `.env`. The first run downloads the selected Whisper model weights, so `tiny` is recommended for a fast smoke test and `base` or above for better quality.

### TTS Providers

The MVP supports three TTS modes through `.env`:

- `TTS_PROVIDER=mock`: writes a silent `voice.wav`, best for guaranteed demos.
- `TTS_PROVIDER=edge_tts`: generates a real voice with `edge-tts`, then converts it to `voice.wav` through ffmpeg.
- `TTS_PROVIDER=fishspeech`: calls a FishSpeech-compatible HTTP endpoint, defaulting to `http://127.0.0.1:7860/v1/audio/speech`.

FishSpeech is wired as an adapter, not bundled as a heavy model runtime. Start your FishSpeech service separately, then set:

```bash
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:7860/v1/audio/speech
FISHSPEECH_VOICE=default
```

## MVP Flow

Open Studio, enter a video URL or local file path, create a task, and watch the pipeline advance:

Extract script -> AI rewrite -> TTS -> digital human -> auto edit -> title/cover -> publish

Task creation supports two modes:

- `mock`: deterministic in-memory progress and mock artifacts.
- `semi_real`: attempts local adapters where available, with mock fallback for unfinished or missing pieces.

Semi-real tasks also write:

- `transcript_segments.json` when Whisper/faster-whisper returns timing segments.
- `title_cover.json` with title variants, hashtags, and cover prompts.
- `publish_draft.json` with final video path, platform targets, and manual confirmation status.

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
  "title": "DevShorts AI demo",
  "mode": "semi_real",
  "topic": "open-source AI video workflows",
  "speaking_style": "technical"
}
```

## Project Layout

```text
apps/
  web/      Next.js control console
  api/      FastAPI mock workflow API
packages/
  shared/   Shared TypeScript contracts
docs/
  ARCHITECTURE.md
  ROADMAP.md
  API.md
```

## Development Notes

- Heavy model inference and real publishing are not implemented in this MVP.
- Every workflow service has a dedicated module for future replacement.
- The API keeps tasks in memory. Restarting the API clears task history.
- Generated artifacts are represented in the task `artifacts` map until durable storage is added.
- Generated media artifacts and runtime settings are ignored by git.
