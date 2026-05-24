# DevShorts AI Project Upgrade Plan

Last updated: 2026-05-23

## Goal

DevShorts AI should become a real local AI Video Production Studio:

1. Topic or source video in.
2. LLM generates structured narration.
3. FishSpeech generates fixed-voice segmented TTS.
4. Subtitle and scene timeline stay synced.
5. Remotion and FFmpeg export a playable `final.mp4`.
6. `/studio` shows the honest runtime state, not fake monitoring.

The product direction is Runway / ElevenLabs / Cursor-style creator tooling: glassy, deep dark, workflow-first, and screen-record friendly.

## Non-Goals For The Current Upgrade

- No auth system.
- No database migration.
- No Redis/Celery queue.
- No platform upload automation.
- No fake GPU metrics, fake frame counters, fake render percentages, or fake ffmpeg logs in real `/studio`.
- No return to single long TTS plus punctuation-based scene timing.

## Hard Rules To Preserve

### Voice

- Multi-scene videos use segmented TTS: `scene-0.wav`, `scene-1.wav`, etc.
- One video uses one voice profile/reference consistently.
- Rank narration belongs to its own scene: `第二...` must start scene 2, never end scene 1.
- Final `voice.wav` is built from scene wavs plus the configured silence gap.

### Sync

- `timeline.json` is generated from real per-scene wav durations.
- `timeline.json` is the single source of truth for visual switching.
- `visualStartMs <= speechStartMs`.
- Frame math uses one FPS value and integer frame starts derived from milliseconds.

### Runtime Honesty

- Missing artifacts show `pending` or `waiting`.
- Demo/showcase data can exist, but `/studio` must clearly represent real runtime state.
- Generated artifacts remain under `apps/api/artifacts/`.

## Upgrade Phases

### Phase 1: Stabilize The Workspace

Purpose: make the project easier to upgrade without breaking the working media chain.

- Add this upgrade plan to docs.
- Add a single verification command for web, render, and API checks.
- Add a stable real `/studio` screenshot export flow.
- Keep generated screenshot/output directories out of source control.
- Do not change TTS, Remotion, FFmpeg, or timeline generation logic in this phase.

Acceptance:

- `npm run verify` runs the main local checks.
- `npm run screenshots:real` exports real `/studio` screenshots from runtime/demo artifacts.
- The generated screenshot flow uses `/studio`, not `/showcase`.

### Phase 2: Runtime UI Productization

Purpose: turn `/studio` from a presentational dashboard into an interactive creator pipeline.

- Workflow steps switch the center workspace.
- Scenes are selectable and drive the preview/timeline panels.
- Asset panel opens real artifacts without letting raw JSON dominate the first screen.
- Empty, pending, fallback, and ready states are visually distinct.
- Wide desktop layout stays fixed-height with panel-level scrolling.

Acceptance:

- 1920, 2K, 3K, and MacBook-window screenshots have no white system scrollbars.
- First screen looks like a real AI Studio, not a form page.
- Users can operate the core workflow with clicks.

### Phase 3: Pipeline Reliability

Purpose: keep the first real AI video path dependable.

- Keep segmented FishSpeech voice generation stable.
- Add stronger validation around speech segments, rank prefixes, and voice profile consistency.
- Keep timeline sync validation close to the render step.
- Improve logs so failures are clear without pretending a fallback is success.

Acceptance:

- A completed task has `voice.wav`, `subtitles.srt`, `timeline.json`, scene wavs, and `final.mp4`.
- Sync checks fail loudly when visuals lag speech.
- Voice profile selection is explicit and reusable.

### Phase 4: Open-Source Readiness

Purpose: make the project understandable to outside users.

- Align README, architecture docs, API docs, and roadmap with the real product slice.
- Add small smoke-test fixtures and clear local setup notes.
- Document FishSpeech and fallback provider behavior.
- Keep generated artifacts, local settings, and large media files out of commits.

Acceptance:

- A new developer can start API/web, run `npm run verify`, and inspect `/studio`.
- Docs explain the real pipeline and its current limitations.

## Immediate Execution Checklist

- [x] Create project plan doc.
- [x] Add `npm run verify`.
- [x] Add `npm run screenshots:real`.
- [x] Ignore generated screenshot/showcase artifact directories.
- [x] Run verification and report gaps.
