from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    api_cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1):\d+"
    default_provider: str = "mock"
    task_store_driver: str = "memory"
    artifacts_dir: str = "artifacts/outputs"
    llm_provider: str = "mock"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: int = 180
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    asr_provider: str = "mock"
    whisper_model: str = "base"
    whisper_language: str = "auto"
    tts_provider: str = "edge_tts"
    edge_tts_voice: str = "zh-CN-XiaoxiaoNeural"
    fishspeech_base_url: str = "http://127.0.0.1:8080/v1/tts"
    fishspeech_api_key: str = ""
    fishspeech_voice: str = "default"
    fishspeech_reference_audio_path: str = ""
    fishspeech_reference_text: str = ""
    fishspeech_reference_text_path: str = ""
    fishspeech_use_memory_cache: str = "auto"
    fishspeech_timeout_seconds: int = 180

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


settings = Settings()
