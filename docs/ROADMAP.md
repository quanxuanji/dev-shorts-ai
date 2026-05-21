# Roadmap

## Phase 1 - Mock Studio Skeleton

- Next.js dashboard, studio, and settings screens.
- FastAPI mock workflow endpoints.
- In-memory task store with simulated pipeline progress.
- Provider/service adapter structure.
- Architecture, API, and roadmap documentation.
- Local startup with minimal dependencies.

## Phase 2 - Local Pipeline Contracts

- Add task create fields for URL, local file path, title, mode, topic, and speaking style.
- Add `mock` and `semi_real` task modes.
- Expose generated artifacts on task responses.
- Keep graceful fallback behavior when optional local tools are missing.

## Phase 3 - Semi-real MVP

- Document optional ffmpeg, yt-dlp, Whisper/faster-whisper, and edge-tts dependencies.
- Preserve mock-first onboarding while preparing semi-real adapters.
- Keep publishing as a safe placeholder until platform providers are explicit.
- Add editable runtime settings for provider routing.
- Add Whisper CLI and optional faster-whisper ASR paths.
- Improve subtitle splitting for English and Chinese scripts.
- Generate `transcript_segments.json` from real ASR runs.
- Generate `title_cover.json` for publishing drafts.
- Generate `publish_draft.json` as an assisted publishing handoff manifest.

## Next

- Real ASR quality pass with model download UX and language/model selection polish.
- Script template library for Chinese developer short videos.
- Subtitle alignment from TTS word boundaries or ASR segment retiming.
- Playwright publishing assistant with explicit user confirmation.
- Real TTS provider integration beyond edge-tts and FishSpeech HTTP.
- Digital human adapter for lip sync or avatar generation.
- B-roll search/import and render composition.
- Assisted platform publishing with explicit user confirmation.
- Redis/Celery task backend and durable artifact storage.
- SSE or WebSocket task updates.
- Docker production profile and deployment guide.
