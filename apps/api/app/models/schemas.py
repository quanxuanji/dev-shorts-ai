from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

StepStatus = Literal["pending", "running", "success", "error"]
TaskStatus = Literal["queued", "running", "success", "error"]
ModelState = Literal["online", "standby", "mock", "offline", "error"]
TaskMode = Literal["mock", "semi_real"]
LLMProviderName = Literal["mock", "openai", "openai_compatible", "ollama"]
ASRProviderName = Literal["mock", "whisper_cli", "faster_whisper"]
TTSProviderName = Literal["mock", "edge_tts", "fishspeech"]
FishSpeechMemoryCache = Literal["auto", "on", "off"]


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    service: str = "devshorts-api"


class SystemStatus(BaseModel):
    cpu_percent: int
    ram_percent: int
    gpu_percent: int
    gpu_memory_percent: int
    inference_latency_ms: int = 0
    tokens_per_second: int = 0
    active_models: int = 0
    queue_depth: int
    active_tasks: int
    uptime: str


class ModelStatus(BaseModel):
    name: str
    kind: str
    state: ModelState
    latency_ms: int
    provider: str
    note: str
    tokens_per_second: int = 0
    queue: int = 0
    gpu_percent: int = 0


class ServiceStatus(BaseModel):
    services: list[ModelStatus]


class WorkflowStep(BaseModel):
    id: str
    label: str
    status: StepStatus = "pending"
    progress: int = Field(default=0, ge=0, le=100)
    output: str | None = None


class TaskLog(BaseModel):
    timestamp: datetime
    level: Literal["info", "warn", "error"]
    message: str


class Task(BaseModel):
    id: str
    title: str
    source_url: str = ""
    local_file_path: str | None = None
    topic: str | None = None
    target_style: str | None = None
    speaking_style: str | None = None
    reference_text: str | None = None
    script_prompt: str | None = None
    mode: TaskMode = "semi_real"
    status: TaskStatus
    current_step: str | None = None
    progress: int = Field(default=0, ge=0, le=100)
    created_at: datetime
    updated_at: datetime
    steps: list[WorkflowStep]
    logs: list[TaskLog]
    artifacts: dict[str, Any] = Field(default_factory=dict)


class CreateTaskRequest(BaseModel):
    source_url: str = ""
    local_file_path: str | None = None
    title: str | None = None
    mode: TaskMode = "semi_real"
    topic: str | None = None
    target_style: str | None = None
    speaking_style: str | None = "technical"
    reference_text: str | None = None
    script_prompt: str | None = None
    script: str | None = None


class RuntimeSettings(BaseModel):
    llm_provider: LLMProviderName = "mock"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: int = 180
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    asr_provider: ASRProviderName = "mock"
    whisper_model: str = "base"
    whisper_language: str = "auto"
    tts_provider: TTSProviderName = "edge_tts"
    edge_tts_voice: str = "zh-CN-XiaoxiaoNeural"
    fishspeech_base_url: str = "http://127.0.0.1:8080/v1/tts"
    fishspeech_api_key: str = ""
    fishspeech_voice: str = "default"
    fishspeech_reference_audio_path: str = ""
    fishspeech_reference_text: str = ""
    fishspeech_reference_text_path: str = ""
    fishspeech_use_memory_cache: FishSpeechMemoryCache = "auto"
    fishspeech_timeout_seconds: int = 180
    video_resolution: str = "1080x1920"
    subtitle_style: str = "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101018,BorderStyle=1,Outline=2,Shadow=0"


class UpdateRuntimeSettingsRequest(BaseModel):
    llm_provider: LLMProviderName | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    openai_timeout_seconds: int | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    asr_provider: ASRProviderName | None = None
    whisper_model: str | None = None
    whisper_language: str | None = None
    tts_provider: TTSProviderName | None = None
    edge_tts_voice: str | None = None
    fishspeech_base_url: str | None = None
    fishspeech_api_key: str | None = None
    fishspeech_voice: str | None = None
    fishspeech_reference_audio_path: str | None = None
    fishspeech_reference_text: str | None = None
    fishspeech_reference_text_path: str | None = None
    fishspeech_use_memory_cache: FishSpeechMemoryCache | None = None
    fishspeech_timeout_seconds: int | None = None
    video_resolution: str | None = None
    subtitle_style: str | None = None


class VoiceProfile(BaseModel):
    id: str
    name: str
    reference_audio_path: str
    reference_text_path: str
    reference_text: str = ""
    preview_audio_path: str | None = None
    source_task_id: str | None = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


class VoiceLibraryResponse(BaseModel):
    voices: list[VoiceProfile]
    default_voice_id: str | None = None


class CreateVoiceRequest(BaseModel):
    voice_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$")
    name: str
    reference_audio_path: str
    reference_text: str
    source_task_id: str | None = None
    make_default: bool = True


class WorkflowRequest(BaseModel):
    task_id: str | None = None
    source_url: str | None = None
    script: str | None = None
    topic: str | None = None
    target_style: str | None = None
    speaking_style: str | None = None
    voice: str | None = "studio-default"
    platform: str | None = "douyin"
    options: dict[str, Any] = Field(default_factory=dict)


class WorkflowResponse(BaseModel):
    step: str
    status: StepStatus
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


class StudioAsset(BaseModel):
    name: str
    kind: str
    path: str
    url: str | None = None
    size_bytes: int = 0
    exists: bool = False
    detail: str = ""


class StudioScene(BaseModel):
    scene_index: int
    rank: int | None = None
    title: str
    summary: str = ""
    narration: str = ""
    caption: str = ""
    tags: list[str] = Field(default_factory=list)
    growth: str = ""
    speech_start_ms: int | None = None
    speech_end_ms: int | None = None
    silence_start_ms: int | None = None
    silence_end_ms: int | None = None
    visual_start_ms: int | None = None
    visual_end_ms: int | None = None
    from_frame: int | None = None
    duration_in_frames: int | None = None
    audio_path: str | None = None
    audio_duration_ms: int | None = None


class StudioSubtitle(BaseModel):
    index: int
    start_ms: int
    end_ms: int
    text: str


class StudioRuntimeData(BaseModel):
    mode: Literal["runtime", "demo"]
    task_id: str
    title: str
    topic: str = ""
    target_style: str = ""
    platform: str = "douyin"
    output_ratio: str = "1080x1920"
    status: TaskStatus = "success"
    current_step: str | None = None
    progress: int = Field(default=0, ge=0, le=100)
    provider: dict[str, Any] = Field(default_factory=dict)
    scenes: list[StudioScene] = Field(default_factory=list)
    timeline: dict[str, Any] = Field(default_factory=dict)
    subtitles: list[StudioSubtitle] = Field(default_factory=list)
    waveform: dict[str, Any] = Field(default_factory=dict)
    assets: list[StudioAsset] = Field(default_factory=list)
    logs: list[TaskLog] = Field(default_factory=list)
    task: Task | None = None
