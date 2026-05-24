# DevShorts AI

DevShorts AI is an open-source voiceover script and AI audio generator for short videos. It helps programmers and AI builders turn source videos, local clips, or topic notes into rewritten scripts, FishSpeech-compatible narration audio, subtitles, and a rendered `final.mp4`.

The current MVP is local-first. It can run with lightweight fallbacks, while the main `semi_real` path uses local/video URL input, ffmpeg media handling, optional Whisper/faster-whisper ASR, OpenAI-compatible or fallback LLM rewriting, edge-tts or FishSpeech-compatible TTS, subtitle generation, and final video rendering.

## Stack

- Frontend: Next.js, TypeScript, TailwindCSS
- Backend: FastAPI, Python
- Task state: in-memory store for now
- Runtime settings: `apps/api/artifacts/runtime-settings.json`
- Artifacts: `apps/api/artifacts/outputs/{taskId}/`

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

## Voice Providers

- `TTS_PROVIDER=mock`: writes a silent fallback `voice.wav` for smoke tests.
- `TTS_PROVIDER=edge_tts`: generates real narration with `edge-tts`.
- `TTS_PROVIDER=fishspeech`: calls a FishSpeech-compatible HTTP endpoint.

FishSpeech is an adapter, not a bundled model runtime. Run your FishSpeech service separately, then set:

```bash
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_VOICE=default
```

## Product Flow

```text
Source video/topic -> transcript or draft -> short-video script -> FishSpeech/edge-tts voice -> subtitles -> final.mp4
```

Optional tools such as ffmpeg, yt-dlp, Whisper, faster-whisper, edge-tts, and FishSpeech improve the run. Missing tools should produce clear fallback logs and inspectable artifacts rather than crashing the task.
