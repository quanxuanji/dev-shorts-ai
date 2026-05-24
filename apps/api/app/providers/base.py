from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    async def rewrite_script(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
    ) -> str:
        raise NotImplementedError


class SpeechProvider(ABC):
    @abstractmethod
    async def synthesize(self, script: str, voice: str) -> str:
        raise NotImplementedError
