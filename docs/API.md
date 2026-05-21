# API

Base URL: `http://localhost:8000`

## Health

`GET /api/health`

Returns API liveness and version.

## System

`GET /api/system/status`

Returns mock CPU, RAM, GPU, queue, and uptime data.

## Models

`GET /api/models/status`

Returns mock status for LLM, ASR, TTS, Digital Human, and Video Render services.

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
  "mode": "mock",
  "topic": "developer workflow automation",
  "speaking_style": "technical"
}
```

Fields:

- `source_url`: remote video URL. Optional when `local_file_path` is provided.
- `local_file_path`: local source video path for semi-real runs.
- `title`: display title. Defaults to a demo title.
- `mode`: `mock` or `semi_real`.
- `topic`: optional prompt context for rewriting.
- `target_style`: optional target format or audience style.
- `speaking_style`: optional voice/script direction, default `technical`.

`mock` mode returns deterministic progress and mock artifacts. `semi_real` mode is the intended integration path for ffmpeg, yt-dlp, Whisper/faster-whisper, edge-tts, FishSpeech, render, and publishing adapters. Missing tools should degrade to mock artifacts and task logs instead of breaking task inspection.

`GET /api/tasks/{taskId}`

Returns task state, workflow steps, logs, and generated artifacts.

`GET /api/tasks/recent`

Returns the latest in-memory tasks.

Task response highlights:

```json
{
  "id": "task-id",
  "title": "DevShorts AI demo",
  "source_url": "https://example.com/video",
  "local_file_path": null,
  "topic": "developer workflow automation",
  "speaking_style": "technical",
  "mode": "mock",
  "status": "running",
  "current_step": "tts",
  "progress": 42,
  "steps": [],
  "logs": [],
  "artifacts": {
    "extract": "transcript or transcript artifact URL",
    "rewrite": "short-video script or script artifact URL",
    "tts": "audio artifact URL",
    "digital-human": "avatar video artifact URL",
    "render": "final render or manifest URL",
    "cover": "titles and cover prompts",
    "publish": "platform draft or mock publish URL"
  }
}
```

Semi-real artifact keys can also include:

- `transcriptSegments`: path to `transcript_segments.json`.
- `titleCover`: generated title, hashtags, and cover prompt draft.
- `titleCoverPath`: path to `title_cover.json`.
- `publishDraft`: assisted publishing manifest for future Playwright automation.
- `publishDraftPath`: path to `publish_draft.json`.

## Workflow

Workflow endpoints are adapter-facing helpers:

- `POST /api/workflow/extract-script`
- `POST /api/workflow/rewrite-script`
- `POST /api/workflow/tts`
- `POST /api/workflow/digital-human`
- `POST /api/workflow/render-video`
- `POST /api/workflow/publish`

Each returns a typed response suitable for wiring the UI before every real model integration is complete. Publishing endpoints are placeholders and must not trigger real platform actions without an explicit future provider implementation.

## TTS Provider Env

Supported `TTS_PROVIDER` values:

- `mock`: generate fallback silent `voice.wav`.
- `edge_tts`: call the optional `edge-tts` package and convert the result to `voice.wav` with ffmpeg.
- `fishspeech`: call `FISHSPEECH_BASE_URL` as a FishSpeech-compatible HTTP speech endpoint.

FishSpeech env:

```bash
FISHSPEECH_BASE_URL=http://127.0.0.1:7860/v1/audio/speech
FISHSPEECH_API_KEY=
FISHSPEECH_VOICE=default
FISHSPEECH_TIMEOUT_SECONDS=180
```

Supported `ASR_PROVIDER` values:

- `mock`: deterministic transcript.
- `whisper_cli`: calls the `whisper` command if installed.
- `faster_whisper`: calls the optional Python `faster_whisper` package if installed.
