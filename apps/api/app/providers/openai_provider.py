import asyncio
import json
import urllib.error
import urllib.request

from app.providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
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
        if not self.settings.openai_api_key and "api.openai.com" in self.settings.openai_base_url:
            raise RuntimeError("OPENAI_API_KEY is required for the default OpenAI endpoint.")

        payload = {
            "model": self.settings.openai_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是 DevShorts AI 的中文短视频口播编导，专门把技术视频转成适合抖音/视频号录屏展示的开发者口播稿。"
                        "必须输出中文，不要输出英文。不要使用 Markdown 标题。不要解释你的思路，只输出可直接 TTS 的口播文本。"
                        "风格要求：开头 3 秒有钩子，中间讲清流程和价值，结尾给开发者一个行动提示。"
                        "控制在 120 到 180 个中文字，句子短，适合字幕切分和语音合成。"
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
            "temperature": 0.7,
        }
        body = json.dumps(payload).encode("utf-8")
        endpoint = f"{self.settings.openai_base_url.rstrip('/')}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.settings.openai_api_key:
            headers["Authorization"] = f"Bearer {self.settings.openai_api_key}"

        request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"OpenAI-compatible request failed: {exc.code} {detail[:300]}") from exc

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content.strip():
            raise RuntimeError("OpenAI-compatible response did not include rewritten content.")
        return content.strip()
