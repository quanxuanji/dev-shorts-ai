# DevShorts AI

DevShorts AI 是一个本地优先的 AI 短视频工作台。当前主流程是把一个选题、视频直链或后端本机视频路径，转成口播脚本、语音、字幕、时间轴，并用 Remotion 渲染出 `final.mp4`。

项目目前仍是 MVP。能跑通的核心链路已经存在，但部分 UI 入口仍属于待开发能力，README 会明确标注，避免把占位功能当成已完成产品能力。

## 项目结构

```text
apps/
  web/      Next.js Studio 前端，默认 http://localhost:3000
  api/      FastAPI 工作流 API，默认 http://localhost:8000
  render/   Remotion 视频渲染工程
packages/
  shared/   前后端共享 TypeScript 类型
docs/
  API.md
  ARCHITECTURE.md
  ROADMAP.md
```

## 当前真实能力

已接入或可运行：

- 输入选题后生成口播脚本。
- OpenAI-compatible / Ollama / mock LLM provider。
- mock / edge-tts / FishSpeech-compatible TTS provider。
- mock / whisper_cli / faster_whisper ASR provider。
- Remotion 竖屏视频渲染，当前固定 `1080x1920`。
- 生成 `voice.wav`、`subtitles.srt`、`timeline.json`、`script_sections.json`、`scene_plan.json`、`final.mp4` 等 artifacts。
- Web Studio 展示任务状态、日志、脚本、场景、预览视频、时间轴和导出文件。

待开发或半成品：

- `参考链接`：暂不支持解析普通网页内容。当前后端只保留视频直链/本地路径调试链路。
- `本地视频`：暂未做浏览器上传。当前只支持填写后端机器能访问的本机路径。
- `目标平台`：现在只是展示项，不会影响脚本、尺寸、字幕安全区或发布流程。
- `输出比例`：UI 已展示 `9:16 / 1:1 / 16:9`，但当前 Remotion 和后端兜底渲染只真正支持 `1080x1920` 竖屏。

## 本地运行环境

建议环境：

- Node.js 20+
- Python 3.11+
- npm
- ffmpeg，推荐安装，用于音频提取、格式转换、视频探测和兜底渲染
- 可选：yt-dlp、Whisper、faster-whisper、FishSpeech 服务

安装依赖：

```powershell
cd C:\Users\use\Documents\GitHub\dev-shorts-ai
npm install
python -m venv apps\api\.venv
apps\api\.venv\Scripts\python.exe -m pip install -r apps\api\requirements.txt
```

如果要测试 Whisper ASR：

```powershell
apps\api\.venv\Scripts\python.exe -m pip install -r apps\api\requirements-asr.txt
```

## 配置文件位置

### API 配置：`apps/api/.env`

FastAPI 是在 `apps/api` 目录里启动的，所以 `pydantic-settings` 会读取：

```text
apps/api/.env
```

不是根目录 `.env`。

最小本地开发配置可以这样写：

```env
LLM_PROVIDER=mock
ASR_PROVIDER=mock
TTS_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_SECONDS=180
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_API_KEY=
FISHSPEECH_VOICE=default
FISHSPEECH_TIMEOUT_SECONDS=180
```

`TTS_PROVIDER=mock` 会生成静音占位 `voice.wav`，适合没有 FishSpeech 的电脑做流程开发。

### Web 配置：`NEXT_PUBLIC_API_URL`

Web 默认请求：

```text
http://localhost:8000
```

如果 API 跑在其它端口，比如 `8001`，启动 Web 时要显式指定：

```powershell
$env:NEXT_PUBLIC_API_URL="http://localhost:8001"
npm run dev:web
```

也可以给 `apps/web` 增加 `.env.local`：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 运行时配置：`apps/api/artifacts/runtime-settings.json`

Web 设置页或 `/api/settings` 会把运行时配置持久化到：

```text
apps/api/artifacts/runtime-settings.json
```

注意：这个文件会覆盖 `.env` 里的默认 provider 配置。也就是说，如果你改了 `apps/api/.env` 但页面里仍显示旧 provider，优先检查或删除这个 runtime settings 文件。

该文件属于本地生成物，不应该提交。

## API Key 和兼容接口配置

项目支持 OpenAI-compatible 接口。不要把真实 API key 写进 README、提交到 git，或发到公开仓库。

推荐写入 `apps/api/.env`：

```env
LLM_PROVIDER=openai_compatible
OPENAI_API_KEY=你的_key
OPENAI_BASE_URL=https://你的兼容接口/v1
OPENAI_MODEL=你的模型名
OPENAI_TIMEOUT_SECONDS=180
ASR_PROVIDER=mock
TTS_PROVIDER=mock
```

也可以在 Web 设置页里填：

- LLM Provider: `openai_compatible`
- API Key
- Base URL
- Model
- Timeout

设置页保存后会写入 `apps/api/artifacts/runtime-settings.json`。

本地开发常用组合：

```env
LLM_PROVIDER=openai_compatible
ASR_PROVIDER=mock
TTS_PROVIDER=mock
```

这代表：

- 口播脚本和分镜由远程兼容 LLM 生成。
- ASR 不跑真实识别。
- TTS 用静音占位音频，方便没有 FishSpeech 的电脑继续开发流程。

## 启动项目

### 方式一：默认端口

启动 API：

```powershell
cd C:\Users\use\Documents\GitHub\dev-shorts-ai
cd apps\api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或者使用 npm 脚本：

```powershell
npm run dev:api
```

启动 Web：

```powershell
npm run dev:web
```

打开：

- Studio: http://localhost:3000/studio
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

### 方式二：API 使用备用端口

如果 `8000` 被占用，可以跑 `8001`：

```powershell
cd C:\Users\use\Documents\GitHub\dev-shorts-ai
cd apps\api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

另开一个终端启动 Web：

```powershell
cd C:\Users\use\Documents\GitHub\dev-shorts-ai
$env:NEXT_PUBLIC_API_URL="http://localhost:8001"
npm run dev:web
```

## 工作流说明

Studio 的主流程：

```text
新建视频
  -> 输入选题
  -> 生成口播脚本
  -> 拆分场景 / 分镜
  -> 生成 TTS 音频或 mock 音频
  -> 生成字幕
  -> 生成时间轴
  -> Remotion 渲染 final.mp4
  -> Web 播放和下载
```

后端任务是内存队列。API 重启后，内存里的任务会丢失，但已经写到 `apps/api/artifacts/outputs/{taskId}/` 的文件仍在。

每个任务常见输出：

```text
apps/api/artifacts/outputs/{taskId}/
  reference.txt
  voiceover_script.txt
  scene_plan.json
  speech_segments.json
  voice.wav
  subtitles.srt
  timeline.json
  render_manifest.json
  final.mp4
```

## Provider 说明

### LLM_PROVIDER

支持值：

- `mock`：本地兜底脚本生成。
- `openai`：OpenAI 官方兼容路径。
- `openai_compatible`：任何兼容 `/chat/completions` 的接口。
- `ollama`：本地 Ollama。

### ASR_PROVIDER

支持值：

- `mock`：本地兜底文本。
- `whisper_cli`：调用本机 `whisper` 命令。
- `faster_whisper`：调用 Python `faster_whisper` 包。

### TTS_PROVIDER

支持值：

- `mock`：生成静音 `voice.wav`，最适合流程开发。
- `edge_tts`：使用 edge-tts 生成语音，再转成 wav。
- `fishspeech`：调用 FishSpeech-compatible HTTP 服务。

FishSpeech 示例：

```env
TTS_PROVIDER=fishspeech
FISHSPEECH_BASE_URL=http://127.0.0.1:8080/v1/tts
FISHSPEECH_API_KEY=
FISHSPEECH_VOICE=default
FISHSPEECH_TIMEOUT_SECONDS=180
```

FishSpeech 模型服务不随本项目启动，需要你自己先在本机或局域网启动。

## Remotion 渲染说明

当前 Remotion Composition 固定为：

```text
1080x1920
30fps
```

相关位置：

- `apps/render/src/manifest.ts`
- `apps/render/src/Root.tsx`
- `apps/api/app/services/remotion_render_service.py`
- `apps/api/app/services/video_render_service.py`

因此 UI 里的 `1:1 方屏`、`16:9 横屏` 现在只展示为待开发。真正支持多比例需要同时改：

- Remotion Composition width / height
- render manifest 的尺寸
- 后端 FFmpeg 兜底渲染的 scale/crop/color 配置
- 前端预览和安全区
- 字幕字号和布局规则

## 常见问题

### 页面白屏或打不开

先确认端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,8000,8001 -ErrorAction SilentlyContinue
```

再看日志：

```powershell
Get-Content web-dev.log -Tail 120
Get-Content api-dev.log -Tail 120
```

### Web 能打开，但任务一直失败

检查：

- `NEXT_PUBLIC_API_URL` 是否指向当前 API 端口。
- `http://localhost:8000/api/health` 或 `http://localhost:8001/api/health` 是否正常。
- `apps/api/artifacts/runtime-settings.json` 是否覆盖了你刚改的 `.env`。

### API Key 改了没生效

优先级是：

1. `apps/api/artifacts/runtime-settings.json`
2. `apps/api/.env`
3. 代码默认值

如果想完全按 `.env` 重置，先停 API，删除：

```text
apps/api/artifacts/runtime-settings.json
```

再重新启动 API。

### 本地没有 FishSpeech 怎么办

用：

```env
TTS_PROVIDER=mock
```

这样会生成静音占位音频，但完整流程可以继续跑，适合开发和调 UI。

## 开发检查

前端 lint：

```powershell
npm --workspace apps/web run lint
```

API 测试：

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m pytest tests -q
```

渲染工程类型检查：

```powershell
npm run typecheck:render
```
