# Architecture

DevShorts AI is a local-first voiceover script and AI audio generator for short videos. The architecture is split into a web console, an API orchestration layer, provider adapters, local runtime settings, and media services that produce script, narration audio, subtitles, and `final.mp4`.

## System Overview

```mermaid
flowchart LR
  Web[Next.js Studio Console] --> API[FastAPI API]
  API --> TaskStore[In-memory Task Store]
  API --> Settings[Runtime Settings]
  API --> Services[Workflow Services]
  Services --> Providers[AI Provider Interface]
  Services --> Media[Media Adapters]
  Providers --> Fallback[Fallback Provider]
  Providers --> OpenAI[OpenAI-compatible Adapter]
  Providers --> Ollama[Ollama Adapter]
  Media --> FFmpeg[ffmpeg Render]
  Media --> Whisper[Whisper/faster-whisper Adapter]
  Media --> TTS[edge-tts/FishSpeech Adapter]
```

## Frontend

`apps/web` is a Next.js App Router application. It contains three MVP screens:

- Dashboard: system status, model service status, estimated GPU/CPU/RAM telemetry, recent tasks.
- Studio: step-by-step voiceover workflow with live status updates, script/audio artifacts, and task logs.
- Settings: API key, local model, inference, TTS, and video output configuration UI.

The UI is optimized for a product-grade AI runtime console: dark theme, status lights, dense cards, timeline pipeline, and console-style logs that make provider fallbacks obvious.

## Backend

`apps/api` is a FastAPI application with these layers:

- `app/api/routes`: HTTP routes grouped by health, system, models, tasks, and workflow.
- `app/services`: workflow modules for ASR, script rewrite, TTS, subtitles, rendering, and fallback behavior.
- `app/providers`: provider interface plus fallback/OpenAI-compatible/Ollama adapter paths.
- `app/models`: Pydantic request/response models.
- `app/core/config.py`: environment-driven settings.
- `app/services/settings_service.py`: runtime provider settings persisted under `artifacts/runtime-settings.json`.

## Task Flow

Task creation stores a task in the local in-memory store. `mock` tasks provide deterministic smoke-test progress and placeholder artifacts. `semi_real` tasks run in a background thread and write artifacts under `artifacts/outputs/{taskId}/`. Each workflow step moves through `pending`, `running`, and `success`, with logs appended as the task progresses.

The intended future replacement is Redis/Celery:

- Keep the API route contracts stable.
- Replace `TaskService` storage and background simulation with durable queue jobs.
- Emit realtime updates through WebSocket/SSE after the polling MVP.

## Provider Strategy

All model-facing work should go through provider/service adapters:

- LLM: `LLMProvider`
- ASR: `ASRService`
- TTS: `TTSService`
- Video Render: `VideoRenderService`

The project ships with fallback providers, ffmpeg media steps, edge-tts, FishSpeech HTTP adapter, Whisper CLI/faster-whisper adapter paths, and OpenAI/Ollama LLM provider paths. Heavy runtimes remain optional and should stay behind service contracts.

## Non-goals for V0.1

- Account system or billing
- Durable task execution
- Bundled heavyweight model runtimes
