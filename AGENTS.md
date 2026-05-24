# DevShorts AI Agent Guide

## Project Identity

DevShorts AI is an open-source voiceover script and FishSpeech-compatible audio generator for programmer-focused short videos. The priority is a visually strong local MVP that turns video/topic input into rewritten scripts, narration audio, subtitles, and a rendered `final.mp4`, while staying ready for future real model integrations.

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

- `mock`: deterministic fallback pipeline for UI/API smoke tests.
- `semi_real`: local/video URL input, ffmpeg audio extraction/rendering, fallback ASR/LLM when providers are unavailable, real edge-tts optional, FishSpeech HTTP adapter, subtitles, final video output.

The semi-real target output is:

```text
apps/api/artifacts/outputs/{taskId}/final.mp4
```

## Provider Status

- LLM: `mock`, OpenAI-compatible, Ollama placeholders.
- ASR: `mock`, Whisper CLI, optional faster-whisper adapter.
- TTS: `mock`, `edge_tts`, `fishspeech` HTTP adapter.
- Digital human: not a core concept for the current product slice; keep any legacy adapter boundaries out of the main UX.
- Platform upload automation: not a core concept for the current product slice; do not present it as an active workflow.
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
- purple/blue accents, but not cheap cyberpunk neon.
- glass panels, subtle glow, animated status, and deep dark spatial backgrounds.
- workflow timeline must clearly show pending/running/success/error.
- runtime console should feel alive.
- avoid plain enterprise dashboard styling.
- real `/studio` should feel like an AI Studio / Creator Pipeline, not a form page or a showcase poster.
- Wide desktop is the primary target. 3K/2K/1920 screens should show the left workflow, center workspace, right preview/assets/logs, and bottom timeline/status strip without feeling like a long marketing page.
- UI must be interactive, not just presentational: workflow steps should switch the workspace, scenes should be selectable, preview/export/log panels should respond to real task state.
- Showcase pages may use demo mode, but runtime `/studio` must distinguish real data, pending, waiting, and empty states clearly.

The app currently supports Chinese/English UI switching. Prefer Chinese copy for user-facing defaults unless a specific technical label is better in English.

## Hard-Won Runtime Rules

These rules came from real failures during the first generated video validation. Do not regress them.

### TTS and Voice Consistency

- Use segmented TTS for multi-scene videos: generate `scene-0.wav`, `scene-1.wav`, etc., then concatenate with silence.
- Do not return to a single long TTS blob and infer scene boundaries from punctuation.
- Every scene narration must contain its own rank prefix, for example `第一，...`, `第二，...`.
- Rank words such as `第二/第三/第四` must belong to the next scene, never the previous scene tail.
- Every scene in one video must use the same voice preset/reference. If FishSpeech is used, keep the same `reference_id` / reference audio / voice profile across all scene TTS calls.
- FishSpeech does not provide a reliable built-in voice library UI. The product should maintain its own voice profiles / fixed presets when users find a voice they like.

### Audio/Visual Sync

- Timeline must be generated from real per-scene wav durations after TTS, not from text length, average allocation, or old `scene.durationSec`.
- Final `voice.wav` should be assembled as:

```text
scene-0.wav
0.5s silence
scene-1.wav
0.5s silence
scene-2.wav
...
```

- `timeline.json` is the single source of truth for Remotion scene switching.
- Remotion should mount global final `voice.wav` once. Individual scenes should not mount their own audio.
- `visualStartMs` must not be later than `speechStartMs`. Prefer switching the next visual 200-300ms before the next speech starts.
- Page switches should happen during the silence gap. It is better for visuals to lead by 0.2s than to lag behind speech.
- Frame math uses one FPS value, currently 30, and computes all `fromFrame` values from milliseconds first, then derives durations from adjacent start frames.

### Real Data vs Demo Data

- Do not hide broken runtime state behind fake dashboards.
- Never add fake frame counters, fake render percentages, fake GPU metrics, fake ffmpeg logs, or fake live monitoring to real `/studio`.
- It is fine to show demo mode in `/showcase`, but `/studio` must remain honest: real artifacts, pending states, waiting states, and real logs only.
- If an artifact is missing, show `pending` / `waiting`, not a fake completed file.

### Local Dev Gotchas

- If web runs on port 3001, API CORS must allow `http://localhost:3001` and `http://127.0.0.1:3001`.
- After running `npm run build:web`, the Next dev server may need a restart before screenshot/browser verification; otherwise static CSS may be stale or served incorrectly.
- Prefer restarting the web dev server after production builds when continuing UI work.
- Keep the API and web dev servers alive for user inspection when the user asks to open/test the page.

## Collaboration Rules

- Preserve `mock` mode as a deterministic fallback/smoke-test path.
- Preserve semi-real mode; it is important for credibility.
- If optional tools are missing, log the fallback instead of crashing the task.
- Keep changes scoped and adapter-friendly.
- Avoid introducing complex dependencies unless the user explicitly chooses that tradeoff.
- Never remove user artifacts or generated outputs unless asked.
