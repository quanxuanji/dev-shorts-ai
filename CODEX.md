# CODEX Notes for DevShorts AI

Read `AGENTS.md` first for the project rules. This file is a shorter operating memo for future Codex sessions.

## What This Project Is

DevShorts AI is a developer-facing AI short-video workflow studio. It is meant to look and feel like a real AI production pipeline while staying light enough to run locally and open source cleanly.

Current goal: evolve the semi-real MVP into a reliable local product without breaking the mock recording demo.

## Important Paths

- Web app: `apps/web`
- API app: `apps/api`
- API entry: `apps/api/app/main.py`
- Task runner: `apps/api/app/services/task_service.py`
- TTS: `apps/api/app/services/tts_service.py`
- Render: `apps/api/app/services/video_render_service.py`
- Runtime settings: `apps/api/app/services/settings_service.py`
- Artifacts: `apps/api/artifacts/outputs`
- Env example: `.env.example`

## Known Good State

The local pipeline has successfully generated a real `final.mp4` using:

- local desktop MP4 input.
- ffmpeg audio extraction.
- Whisper CLI real ASR.
- Real Whisper CLI dependency is tracked in `apps/api/requirements-asr.txt`.
- Xiaomi/OpenAI-compatible LLM rewrite through `mimo-v2.5-pro`.
- edge-tts Chinese voice.
- generated subtitles aligned from voice duration.
- `title_cover.json` with title variants, hashtags, and cover prompts.
- `publish_draft.json` as an assisted platform publishing handoff.
- ffmpeg final render.

The API serves artifacts from:

```text
http://127.0.0.1:8000/artifacts/outputs/{taskId}/final.mp4
```

## Current TTS Setup

Default:

```env
TTS_PROVIDER=edge_tts
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural
```

FishSpeech adapter is available through:

```env
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:7860/v1/audio/speech
FISHSPEECH_VOICE=default
```

FishSpeech itself is not bundled. It should run as a separate local service.

Runtime provider settings are editable through the Settings page and persisted locally to:

```text
apps/api/artifacts/runtime-settings.json
```

## Before Editing

- Check current files before assuming structure.
- Use `rg` for search.
- Use `apply_patch` for manual edits.
- Do not delete generated videos or user files.
- Keep README/docs updated when changing behavior.

## Preferred Checks

```powershell
python -m compileall -f apps/api/app
npm run typecheck
npm run lint:web
npm run build:web
```

If touching runtime media flow, run an API smoke task in `semi_real` mode.

## Product Gap Map

The project is no longer just a shell, but it is not yet a reliable product. Major gaps:

- Task reliability: tasks are still in memory, with no durable status, retry, cancel, or resume.
- Artifact management: files exist on disk, but there is no durable manifest, cleanup policy, metadata index, or cloud storage adapter.
- ASR productization: Whisper works, but model download UX, language/model selection polish, faster-whisper GPU/CPU modes, and quality controls are still thin.
- LLM scripting: Chinese prompt works, but template library, platform-specific styles, multi-version generation, scoring, and script editing are missing.
- TTS productization: edge-tts works, FishSpeech is only an HTTP adapter; voice selection, speed/emotion controls, retries, and word boundaries are missing.
- Subtitle system: basic SRT exists, but precise word timing, style templates, keyword highlight, bilingual subtitles, and editor UI are missing.
- Video rendering: current render is source video plus voice/subtitles; no smart crop, B-roll, transitions, background music, cover image generation, or render templates.
- Digital human: LatentSync/Wav2Lip is still skipped.
- Publishing: only `publish_draft.json`; no Playwright profile, platform login detection, draft upload, screenshots, or recovery.
- Frontend product UX: missing task detail page, video player preview, script/subtitle editors, step rerun, connection tests, and better error detail.
- Observability: missing structured logs, per-step duration, provider latency, ffmpeg stderr archive, trace ids, success/failure rates, and queue metrics.
- Security/config: runtime settings are local JSON; secrets need masking/encryption and provider connection tests.
- Engineering: missing pytest, service tests, Playwright tests, CI, fixtures, Docker verification, and cross-platform docs.
- Open-source packaging: needs demo GIF, screenshots, architecture update, examples, contributing guide, license, bilingual README, and Docker one-command start.

## Upgrade Roadmap

### V0.4 Reliable Task System

Goal: move from "can run" to "can fail, recover, and explain why."

Priority work:

- Add SQLite task persistence.
- Store task steps, logs, artifacts, and progress durably.
- Add artifact manifest per task.
- Track per-step start/end time and duration.
- Persist ffmpeg/provider stderr snippets for debugging.
- Add task detail API and page.
- Add retry / rerun failed task or failed step.
- Add API smoke test script.

### V0.5 Production Editing Experience

Goal: make generated output controllable by a human operator.

- Add video preview player.
- Add script editor and save edited script.
- Add subtitle preview/editor.
- Add title/cover draft editor.
- Add "rerun from this step" controls.
- Add provider connection test buttons in Settings.
- Improve UI for artifact file list and downloads.

### V0.6 Provider System

Goal: let users reliably choose their own AI stack.

- Polish Whisper/faster-whisper model/language selection.
- Add model download/status UX.
- Add FishSpeech integration guide and connection test.
- Add MiniMax / OpenAI TTS provider.
- Standardize OpenAI-compatible LLM provider config.
- Add Ollama local model health check.
- Add provider latency and error reporting.

### V0.7 Video Quality

Goal: move from "assembled video" to "short-video quality output."

- Add 9:16 crop strategies.
- Add subtitle style templates.
- Add background music and audio ducking.
- Add B-roll local library and keyword matching.
- Add cover image generation/export.
- Add render presets and ffmpeg templates.

### V0.8 Publishing Assistant

Goal: turn final artifacts into platform drafts with explicit user control.

- Add Playwright profile management.
- Detect platform login state.
- Upload draft to Douyin / Bilibili / Xiaohongshu.
- Fill title, tags, cover, and description.
- Require manual confirmation before real publish.
- Save publish logs and failure screenshots.

### V1.0 Reliable Local Product

Goal: open-source usable product with maintainable foundations.

- Docker one-command local start.
- GitHub Actions CI.
- Cross-platform setup docs.
- Plugin/provider architecture.
- Encrypted settings/secrets.
- Full example project and sample videos.
- Demo GIF/screenshots and bilingual README.
- Contributing guide and license.

## Recommended Next Step

Start V0.4 first. Do not jump to digital human or publishing before task persistence is in place. The next implementation slice should be:

1. SQLite persistence for tasks.
2. Artifact manifest generation.
3. Step duration tracking.
4. Task detail page.
5. Retry/rerun failed task.
