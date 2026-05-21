import asyncio
import json
import urllib.error
import urllib.request

from app.providers.base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(self, runtime_settings) -> None:
        self.settings = runtime_settings

    async def rewrite_script(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
    ) -> str:
        return await asyncio.to_thread(self._rewrite_sync, script, topic, target_style, speaking_style)

    def _rewrite_sync(
        self,
        script: str,
        topic: str | None,
        target_style: str | None,
        speaking_style: str | None,
    ) -> str:
        payload = {
            "model": self.settings.ollama_model,
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是中文技术短视频编导。必须把转写内容改写成中文开发者口播稿。"
                        "不要输出英文，不要 Markdown，只输出可直接 TTS 的正文。"
                        "开头要有钩子，中间讲流程和价值，结尾给行动提示。控制在 120 到 180 个中文字。"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"主题：{topic or 'DevShorts AI'}\n"
                        f"目标风格：{target_style or '中文开发者短视频'}\n"
                        f"口播风格：{speaking_style or '技术感'}\n"
                        f"原始转写：\n{script}\n\n"
                        "请改写成中文短视频口播稿。"
                    ),
                },
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        endpoint = f"{self.settings.ollama_base_url.rstrip('/')}/api/chat"
        request = urllib.request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Ollama request failed: {exc.code} {detail[:300]}") from exc

        content = data.get("message", {}).get("content") or data.get("response", "")
        if not content.strip():
            raise RuntimeError("Ollama response did not include rewritten content.")
        return content.strip()
