# API

Base URL: `http://localhost:8000`

## Health

`GET /api/health`

Returns API liveness and version.

## System

`GET /api/system/status`

Returns local runtime telemetry for CPU, RAM, GPU, queue depth, and uptime. Some values may be estimated until durable observability is added.

## Models

`GET /api/models/status`

Returns status for the voiceover pipeline services: ASR, LLM script rewriting, TTS, and video render.

## Settings

`GET /api/settings`

Returns editable runtime provider configuration. This is local MVP persistence, not encrypted secret storage.

`PUT /api/settings`

Updates runtime provider configuration for newly created tasks.

```json
{
  "llm_provider": "mock",
  "asr_provider": "whisper_cli",
  "whisper_model": "base",
  "whisper_language": "auto",
  "tts_provider": "edge_tts",
  "edge_tts_voice": "en-US-AriaNeural",
  "subtitle_style": "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101018,BorderStyle=1,Outline=2,Shadow=0"
}
```

## Tasks

`POST /api/tasks/create`

```json
{
  "source_url": "https://example.com/video",
  "local_file_path": null,
  "title": "Optional task title",
  "mode": "semi_real",
  "topic": "developer workflow automation",
  "speaking_style": "technical"
}
```

Fields:

- `source_url`: remote video URL. Optional when `local_file_path` is provided.
- `local_file_path`: local source video path for semi-real runs.
- `title`: display title. Defaults to a generated voiceover task title.
- `mode`: `mock` or `semi_real`.
- `topic`: optional prompt context for rewriting.
- `target_style`: optional target format or audience style.
- `speaking_style`: optional voice/script direction, default `technical`.

`mock` mode returns deterministic progress and placeholder artifacts for smoke tests. `semi_real` mode is the intended product path for ffmpeg, yt-dlp, Whisper/faster-whisper, edge-tts, FishSpeech, script rewriting, subtitles, and final render. Missing tools should degrade to fallback artifacts and clear task logs instead of breaking task inspection.

`GET /api/tasks/{taskId}`

Returns task state, workflow steps, logs, and generated artifacts.

`GET /api/tasks/recent`

Returns the latest in-memory tasks.

Task response highlights:

```json
{
  "id": "task-id",
  "title": "DevShorts AI voiceover run",
  "source_url": "https://example.com/video",
  "local_file_path": null,
  "topic": "developer workflow automation",
  "speaking_style": "technical",
  "mode": "semi_real",
  "status": "running",
  "current_step": "tts",
  "progress": 42,
  "steps": [],
  "logs": [],
  "artifacts": {
    "extract": "transcript or transcript artifact URL",
    "rewrite": "short-video script or script artifact URL",
    "tts": "audio artifact URL",
    "render": "final render or manifest URL",
    "cover": "titles and cover prompts"
  }
}
```

Semi-real artifact keys can also include:

- `transcriptSegments`: path to `transcript_segments.json`.
- `titleCover`: generated title, hashtags, and cover prompt draft.
- `titleCoverPath`: path to `title_cover.json`.
- `voice`: generated `voice.wav` path or URL when available.
- `finalVideo`: generated `final.mp4` path or URL when available.

## Workflow

Workflow endpoints are adapter-facing helpers:

- `POST /api/workflow/extract-script`
- `POST /api/workflow/rewrite-script`
- `POST /api/workflow/tts`
- `POST /api/workflow/render-video`

Each returns a typed response suitable for wiring the UI before every real model integration is complete. These helpers should keep provider failures visible in logs and avoid hiding fallback behavior from the user.

Reserved legacy helpers still exist for compatibility:

- `POST /api/workflow/digital-human`
- `POST /api/workflow/publish`

These are not part of the current voiceover-script product path and should remain placeholder-only unless a future provider is explicitly implemented.

## TTS Provider Env

Supported `TTS_PROVIDER` values:

- `mock`: generate fallback silent `voice.wav`.
- `edge_tts`: call the optional `edge-tts` package and convert the result to `voice.wav` with ffmpeg.
- `fishspeech`: call `FISHSPEECH_BASE_URL` as a FishSpeech-compatible HTTP speech endpoint.

FishSpeech env:

```bash
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_API_KEY=
FISHSPEECH_VOICE=default
FISHSPEECH_TIMEOUT_SECONDS=180
```

Supported `ASR_PROVIDER` values:

- `mock`: deterministic fallback transcript.
- `whisper_cli`: calls the `whisper` command if installed.
- `faster_whisper`: calls the optional Python `faster_whisper` package if installed.
