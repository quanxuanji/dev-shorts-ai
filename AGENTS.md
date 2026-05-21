# DevShorts AI Agent Guide

## Project Identity

DevShorts AI is an open-source AI short-video pipeline studio for programmers and AI developers. The priority is a demoable, visually strong MVP for screen recording, GitHub presentation, and future real model integrations.

The product should feel like an AI Studio / AI Runtime console, not a traditional CRUD admin panel.

## Current Architecture

- Frontend: `apps/web`, Next.js + TypeScript + TailwindCSS.
- Backend: `apps/api`, FastAPI + Python.
- Shared contracts: `packages/shared`.
- Docs: `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ROADMAP.md`.
- Task state: local in-memory store for now.
- Artifacts: `apps/api/artifacts/outputs/{taskId}/`.
- Runtime settings: `apps/api/artifacts/runtime-settings.json`, editable from `/settings`.

## Current Pipeline Modes

- `mock`: animated demo pipeline for recording and presentation.
- `semi_real`: local/video URL input, ffmpeg audio extraction/rendering, mock ASR/LLM by default, real edge-tts optional, FishSpeech HTTP adapter reserved, subtitles, final video output.

The semi-real target output is:

```text
apps/api/artifacts/outputs/{taskId}/final.mp4
```

## Provider Status

- LLM: `mock`, OpenAI-compatible, Ollama placeholders.
- ASR: `mock`, Whisper CLI, optional faster-whisper adapter.
- TTS: `mock`, `edge_tts`, `fishspeech` HTTP adapter.
- Digital human: LatentSync/Wav2Lip adapter reserved, currently skipped in semi-real mode.
- Publishing: Playwright/platform publishing reserved, currently skipped.
- Render: ffmpeg-backed simple final video render.
- Settings: `/api/settings` can switch providers for new semi-real tasks.

Do not add heavyweight model runtimes directly to the repo. Prefer provider/adapters and graceful fallback logs.

## Local Startup

Install:

```powershell
npm install
python -m venv apps/api/.venv
apps/api/.venv/Scripts/Activate.ps1
pip install -r apps/api/requirements.txt
```

Run API:

```powershell
npm run dev:api
```

Run web:

```powershell
npm run dev:web
```

Open:

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

## Verification Commands

Before calling a change done, prefer:

```powershell
python -m compileall -f apps/api/app
npm run typecheck
npm run lint:web
npm run build:web
```

For media pipeline work, also create a `semi_real` task and verify:

- logs show each real/fallback step clearly.
- `voice.wav` is generated.
- `final.mp4` exists.
- `/artifacts/outputs/{taskId}/final.mp4` is accessible from the API.
- `/api/settings` can be read after Settings UI changes.
- Real ASR can be installed with `pip install -r apps/api/requirements-asr.txt`.

## UI Direction

Keep the UI high-impact and screen-record friendly:

- dark AI console style.
- purple/blue neon accents.
- glass panels, subtle glow, animated status.
- workflow timeline must clearly show pending/running/success/error.
- runtime console should feel alive.
- avoid plain enterprise dashboard styling.

The app currently supports Chinese/English UI switching. Prefer Chinese copy for user-facing defaults unless a specific technical label is better in English.

## Collaboration Rules

- Preserve the mock demo mode; it is important for recording.
- Preserve semi-real mode; it is important for credibility.
- If optional tools are missing, log the fallback instead of crashing the task.
- Keep changes scoped and adapter-friendly.
- Avoid introducing complex dependencies unless the user explicitly chooses that tradeoff.
- Never remove user artifacts or generated outputs unless asked.
