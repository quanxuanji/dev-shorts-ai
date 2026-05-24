# CODEX Notes for DevShorts AI

Read `AGENTS.md` first for the project rules. This file is a shorter operating memo for future Codex sessions.

## What This Project Is

DevShorts AI is a developer-facing voiceover script and FishSpeech-compatible audio generator for short videos. It should feel like a real AI production runtime while staying light enough to run locally and open source cleanly.

Current goal: evolve the semi-real voiceover pipeline into a reliable local product while preserving fallback mode for smoke tests.

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
- ffmpeg final render.

The API serves artifacts from:

```text
http://127.0.0.1:8000/artifacts/outputs/{taskId}/final.mp4
```

## 2026-05-23 Session Notes

Today's work moved the product from a working media pipeline toward a real AI Studio UI. The biggest lesson: do not confuse a good-looking showcase with a usable runtime product.

### Current Real Studio State

The real `/studio` page now uses an AI Studio / Creator Pipeline layout:

- left column: project card, clickable workflow, selectable scenes, task queue.
- center workspace: status bar plus stage-specific workspace.
- right column: render preview, export assets, live logs.
- bottom strip: timeline, render logs, TTS durations, timeline sync.

Runtime data is connected through `/api/studio/runtime`, current task artifacts, settings, task logs, and recent tasks. The UI should not depend on showcase-only mock data.

The page is now desktop-first and 3K-friendly:

- wide view uses a fixed-height studio surface.
- left, center, and right columns scroll internally.
- bottom timeline/status strip stays visible.
- workflow clicks switch center workspace.
- scene clicks update selection and preview context.

### UI Lessons

The first real UI rewrite had the correct layout but felt too black, flat, and backend-like. The fix was visual material, not new layout:

- global deep gradient background.
- translucent glass panels.
- subtle purple/cyan glow.
- glowing timeline capsules.
- preview outer glow.
- active workflow/scene highlights.
- typography hierarchy with brighter titles and softer secondary labels.

Keep this distinction:

- Showcase can be polished demo mode.
- Runtime `/studio` must be a real operator UI with honest state.

Do not regress runtime into:

- plain form plus preview.
- marketing poster.
- static dashboard that cannot be clicked.
- fake monitoring UI.

### Interaction Lessons

The first Studio UI pass looked dense but was mostly read-only. That felt like "展示功能". Runtime UI needs operation:

- Workflow items should be buttons, not cards.
- Scene rows/cards should be selectable.
- Selected scenes should visibly glow.
- Center workspace should change by active stage.
- Right preview should reflect selected scene context where possible.
- Asset rows should eventually open/download/preview actual files.

Next UI interaction candidates:

1. Add an explicit history works panel/launcher.
2. Click an asset to preview text/json/audio/video.
3. Click timeline blocks to select scenes.
4. Add stage tabs or keyboard shortcuts only after basic click paths are solid.

### TTS and Sync Lessons

The early full-video validation repeatedly failed because a single long TTS file was hard to split reliably. The correct design is:

1. Generate one TTS wav per scene.
2. Ensure each scene text starts with its own rank phrase.
3. Probe each scene wav duration with ffprobe.
4. Concatenate scene wavs with 0.5s silence.
5. Generate `timeline.json` during concatenation.
6. Render visuals from `timeline.json`.
7. Use one global final `voice.wav` in Remotion.

Never infer scene timing from:

- punctuation.
- text length.
- average duration.
- pre-TTS estimates.
- old scene duration fields.
- silencedetect as the primary timeline source.

Rank phrases are content boundaries:

- `第一，...` belongs to scene 0.
- `第二，...` belongs to scene 1.
- `第三，...` belongs to scene 2.
- The previous scene must never end with the next scene's rank phrase.

Visual timing rule:

- `visualStartMs <= speechStartMs`.
- Prefer `visualStartMs = speechStartMs - 200~300ms`, bounded at zero.
- Page switches should complete before the next rank word is spoken.

### FishSpeech Lessons

FishSpeech can produce good voices, but do not assume it has a product-grade voice library UI.

What worked:

- Use a consistent reference voice/reference id for every segmented TTS call.
- Reuse the same voice profile across all scenes in one video.
- Store voice presets/profiles in this product if users like a generated voice.

What failed:

- Letting each scene call choose its own random/default voice.
- Expecting FishSpeech to expose a usable built-in voice selection page.
- Treating "voice fixed" as optional. It is a hard product rule for one video.

### Local Dev Lessons

CORS matters when web is not on 3000:

```bash
API_CORS_ORIGINS='http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001' \
  .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If Playwright/Chrome shows unstyled HTML after a build, restart the web dev server. Running `npm run build:web` can leave the dev server serving stale or mismatched Next static assets.

Current preferred local inspection URL:

```text
http://localhost:3001/studio
```

Use screenshots after real browser verification, not after compile alone.

## Current TTS Setup

Default:

```env
TTS_PROVIDER=edge_tts
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural
```

FishSpeech adapter is available through:

```env
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_VOICE=default
```

FishSpeech itself is not bundled. It should run as a separate local service.

Runtime provider settings are editable through the Settings page and persisted locally to:

```text
apps/api/artifacts/runtime-settings.json
```

## Runtime UI Rules

When changing `/studio`:

- Do not break existing create/regenerate/render buttons.
- Keep topic, reference URL, local video path, style chips, and direction editable.
- Keep final video preview and download.
- Keep artifact state honest.
- Preserve real task logs.
- Make controls actually clickable when they look clickable.
- Verify on a wide viewport, ideally 2880x1800 or similar, not only 1440px laptop width.
- After major UI changes, run browser verification and inspect a screenshot.

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
- LLM scripting: Chinese prompt works, but template library, platform-specific voiceover styles, multi-version generation, scoring, and script editing are missing.
- TTS productization: edge-tts works, FishSpeech is only an HTTP adapter; voice selection, speed/emotion controls, retries, and word boundaries are missing.
- Subtitle system: basic SRT exists, but precise word timing, style templates, keyword highlight, bilingual subtitles, and editor UI are missing.
- Video rendering: current render is source video plus voice/subtitles; no smart crop, B-roll, transitions, background music, cover image generation, or render templates.
- Frontend product UX: missing task detail page, video player preview, script/subtitle editors, step rerun, connection tests, and better error detail.
- Observability: missing structured logs, per-step duration, provider latency, ffmpeg stderr archive, trace ids, success/failure rates, and queue metrics.
- Security/config: runtime settings are local JSON; secrets need masking/encryption and provider connection tests.
- Engineering: missing pytest, service tests, Playwright tests, CI, fixtures, Docker verification, and cross-platform docs.
- Open-source packaging: needs screenshots, architecture update, examples, contributing guide, license, bilingual README, and Docker one-command start.

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

### V0.8 Export Assistant

Goal: turn final artifacts into well-packaged export bundles with explicit user control.

- Add export manifest with final video, subtitles, voice, title, tags, and cover prompt.
- Add platform-specific metadata presets without triggering real platform actions.
- Add manual checklist state for upload preparation.
- Save export logs and validation errors.

### V1.0 Reliable Local Product

Goal: open-source usable product with maintainable foundations.

- Docker one-command local start.
- GitHub Actions CI.
- Cross-platform setup docs.
- Plugin/provider architecture.
- Encrypted settings/secrets.
- Full example project and sample videos.
- Screenshots and bilingual README.
- Contributing guide and license.

## Recommended Next Step

Start V0.4 first. Do not jump to avatar or platform automation before task persistence is in place. The next implementation slice should be:

1. SQLite persistence for tasks.
2. Artifact manifest generation.
3. Step duration tracking.
4. Task detail page.
5. Retry/rerun failed task.
