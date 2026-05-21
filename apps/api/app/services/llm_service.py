from app.providers.mock_provider import MockProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_provider import OpenAIProvider
from app.services.settings_service import settings_service


class LLMService:
    def __init__(self) -> None:
        self.mock_provider = MockProvider()

    async def rewrite_script(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
    ) -> str:
        rewritten, _ = await self.rewrite_with_logs(script, topic, target_style, speaking_style)
        return rewritten

    async def rewrite_with_logs(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
    ) -> tuple[str, list[str]]:
        runtime_settings = settings_service.get()
        provider_name = runtime_settings.llm_provider.lower().replace("-", "_")
        provider = self._select_provider(provider_name, runtime_settings)
        logs = [f"[LLM] provider selected: {provider_name}"]

        try:
            rewritten = await provider.rewrite_script(script, topic, target_style, speaking_style)
            logs.append("[LLM] rewrite completed.")
            return rewritten, logs
        except Exception as exc:
            logs.append(f"[LLM] provider failed, falling back to mock: {exc}")
            rewritten = await self.mock_provider.rewrite_script(script, topic, target_style, speaking_style)
            logs.append("[LLM] mock rewrite completed.")
            return rewritten, logs

    def _select_provider(self, provider_name: str, runtime_settings):
        if provider_name in {"openai", "openai_compatible", "compatible"}:
            return OpenAIProvider(runtime_settings)
        if provider_name == "ollama":
            return OllamaProvider(runtime_settings)
        return self.mock_provider
