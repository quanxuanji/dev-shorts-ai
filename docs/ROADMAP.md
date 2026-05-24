# Roadmap

## Phase 1 - Studio Skeleton

- Next.js dashboard, studio, and settings screens.
- FastAPI workflow endpoints with fallback responses.
- In-memory task store with simulated pipeline progress.
- Provider/service adapter structure.
- Architecture, API, and roadmap documentation.
- Local startup with minimal dependencies.

## Phase 2 - Local Pipeline Contracts

- Add task create fields for URL, local file path, title, mode, topic, and speaking style.
- Add `mock` and `semi_real` task modes.
- Expose generated artifacts on task responses.
- Keep graceful fallback behavior when optional local tools are missing.

## Phase 3 - Voiceover Script MVP

- Document optional ffmpeg, yt-dlp, Whisper/faster-whisper, and edge-tts dependencies.
- Keep deterministic fallback mode for smoke tests while making `semi_real` the product path.
- Add editable runtime settings for provider routing.
- Add Whisper CLI and optional faster-whisper ASR paths.
- Improve subtitle splitting for English and Chinese scripts.
- Generate `transcript_segments.json` from real ASR runs.
- Generate `title_cover.json` with title variants, hashtags, and cover prompts.
- Generate `voice.wav` through edge-tts or a FishSpeech-compatible HTTP endpoint.

## Next

- Real ASR quality pass with model download UX and language/model selection polish.
- Script template library for Chinese developer short videos.
- Subtitle alignment from TTS word boundaries or ASR segment retiming.
- FishSpeech setup guide, connection test, voice selection, and retry/error display.
- Additional TTS providers beyond edge-tts and FishSpeech HTTP.
- B-roll search/import and render composition.
- Redis/Celery task backend and durable artifact storage.
- SSE or WebSocket task updates.
- Docker production profile and deployment guide.
