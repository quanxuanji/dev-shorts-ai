import json
import re
from typing import Any

from app.providers.mock_provider import MockProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_provider import OpenAIProvider
from app.services.settings_service import settings_service


class LLMService:
    def __init__(self) -> None:
        self.mock_provider = MockProvider()

    async def generate_voiceover_script(
        self,
        reference_text: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
        script_prompt: str | None = None,
    ) -> str:
        generated, _ = await self.generate_voiceover_script_with_logs(
            reference_text,
            topic,
            target_style,
            speaking_style,
            script_prompt,
        )
        return generated

    async def generate_voiceover_script_with_logs(
        self,
        reference_text: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
        script_prompt: str | None = None,
    ) -> tuple[str, list[str]]:
        runtime_settings = settings_service.get()
        provider_name = runtime_settings.llm_provider.lower().replace("-", "_")
        provider = self._select_provider(provider_name, runtime_settings)
        logs = [f"[LLM] voiceover script provider selected: {provider_name}"]
        prompt_context = self._build_voiceover_context(reference_text, topic, target_style, speaking_style, script_prompt)

        if provider_name == "mock":
            logs.append("[LLM] fallback: local script generator selected in settings.")
            generated = self._fallback_voiceover_script(reference_text, topic, target_style, speaking_style, script_prompt)
            logs.append("[LLM] local voiceover script generated.")
            return generated, logs

        try:
            generated = await provider.rewrite_script(
                prompt_context,
                topic,
                target_style or "中文开发者口播",
                speaking_style or "清晰、可信、适合 TTS",
            )
            logs.append("[LLM] Chinese voiceover script generated.")
            return generated.strip(), logs
        except Exception as exc:
            warning = f"[LLM] provider failed; using local fallback voiceover script: {exc}"
            logs.append(warning)
            generated = self._fallback_voiceover_script(reference_text, topic, target_style, speaking_style, script_prompt)
            logs.append("[LLM] local voiceover script generated.")
            return generated, logs

    async def generate_scene_plan_with_logs(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
        script_prompt: str | None = None,
    ) -> tuple[list[dict[str, str]], list[str]]:
        runtime_settings = settings_service.get()
        provider_name = runtime_settings.llm_provider.lower().replace("-", "_")
        provider = self._select_provider(provider_name, runtime_settings)
        logs = [f"[LLM] scene plan provider selected: {provider_name}"]

        if provider_name == "mock":
            logs.append("[LLM] fallback: local scene planner selected in settings.")
            return self._fallback_scene_plan(script), logs

        prompt = self._build_scene_plan_context(script, topic, target_style, speaking_style, script_prompt)
        try:
            raw = await provider.rewrite_script(
                prompt,
                topic,
                target_style or "AI 创作工作台短视频",
                speaking_style or "清晰、可信、适合 TTS",
            )
            scenes = self._parse_scene_plan(raw)
            logs.append("[LLM] structured scene plan generated.")
            return scenes, logs
        except Exception as exc:
            logs.append(f"[LLM] fallback: scene plan provider output was unusable; using local scene plan: {exc}")
            return self._fallback_scene_plan(script), logs

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

    def _build_voiceover_context(
        self,
        reference_text: str,
        topic: str | None,
        target_style: str | None,
        speaking_style: str | None,
        script_prompt: str | None,
    ) -> str:
        return (
            "请基于下面资料生成中文技术短视频口播稿。\n"
            "要求：只输出可直接 TTS 的中文正文；不要 Markdown；不要解释；"
            "开头 3 秒给开发者明确钩子，中段讲清问题、方案和价值，结尾给行动提示；"
            "控制在 120 到 220 个中文字，句子短，适合 FishSpeech 或其他 TTS 合成。\n\n"
            f"主题：{topic or 'DevShorts AI'}\n"
            f"目标风格：{target_style or 'AI Studio / Runtime console'}\n"
            f"口播风格：{speaking_style or '技术感、可信、节奏清晰'}\n"
            f"额外提示：{script_prompt or '无'}\n"
            f"参考资料：\n{reference_text or '没有可用转写，请围绕主题生成一段产品口播。'}"
        )

    def _build_scene_plan_context(
        self,
        script: str,
        topic: str | None,
        target_style: str | None,
        speaking_style: str | None,
        script_prompt: str | None,
    ) -> str:
        return (
            "请把下面中文口播稿拆成适合 Remotion 竖屏短视频的结构化 scenes。\n"
            "只输出 JSON，不要 Markdown，不要解释。\n"
            "JSON 格式必须是：{\"scenes\":[{\"title\":\"短标题\",\"caption\":\"屏幕字幕\",\"narration\":\"完整口播句子\"}]}。\n"
            "要求：4 到 10 个 scenes；如果口播包含 TOP8/TOP10 这类榜单，必须尽量保留每个条目；"
            "title 控制在 12 个中文字以内；caption 控制在 24 个中文字以内；"
            "narration 必须可直接 TTS，不能丢失原稿重点；不要新增不存在的事实。\n\n"
            f"主题：{topic or 'DevShorts AI'}\n"
            f"目标风格：{target_style or 'AI 创作工作台'}\n"
            f"口播风格：{speaking_style or '技术感、可信、节奏清晰'}\n"
            f"额外提示：{script_prompt or '无'}\n"
            f"口播稿：\n{script}"
        )

    def _fallback_voiceover_script(
        self,
        reference_text: str,
        topic: str | None,
        target_style: str | None,
        speaking_style: str | None,
        script_prompt: str | None,
    ) -> str:
        subject = topic or "DevShorts AI"
        style = speaking_style or target_style or "清晰技术感"
        reference = " ".join(reference_text.split())[:120]
        prompt = f"重点是{script_prompt.strip()}。" if script_prompt and script_prompt.strip() else ""
        source_line = f"这次参考资料提到：{reference}。" if reference else "即使只有一个想法，也能先生成稳定的中文口播稿。"
        return (
            f"如果你正在把「{subject}」做成开发者短视频，先别急着剪片。"
            f"{source_line}"
            f"DevShorts AI 会把弱转写、手动资料和创作提示整理成一版{style}的中文口播，"
            "再交给选定的 TTS 生成可下载音频。"
            f"{prompt}"
            "你只需要检查稿子和声音，就能继续接入真实模型和后续制作流程。"
        )

    def _parse_scene_plan(self, raw: str) -> list[dict[str, str]]:
        text = raw.strip()
        fenced = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            text = fenced.group(1).strip()
        data = json.loads(text)
        scenes_value = data.get("scenes") if isinstance(data, dict) else None
        if not isinstance(scenes_value, list):
            raise ValueError("scene plan JSON must include a scenes array")

        scenes: list[dict[str, str]] = []
        for index, scene in enumerate(scenes_value[:10], start=1):
            if not isinstance(scene, dict):
                continue
            narration = str(scene.get("narration") or scene.get("text") or "").strip()
            if not narration:
                continue
            title = str(scene.get("title") or f"Scene {index}").strip()[:24]
            caption = str(scene.get("caption") or narration).strip()[:48]
            scenes.append(
                {
                    "id": f"scene-{index:03d}",
                    "title": title or f"Scene {index}",
                    "caption": caption or narration[:48],
                    "narration": narration,
                }
            )
        if not scenes:
            raise ValueError("scene plan did not include usable narration")
        return scenes

    def _fallback_scene_plan(self, script: str) -> list[dict[str, str]]:
        normalized = " ".join(script.split())
        parts = [part.strip() for part in re.findall(r"[^。！？!?]+[。！？!?]?", normalized) if part.strip()]
        if not parts:
            parts = [normalized or "DevShorts AI 正在生成一段适合短视频的中文口播。"]
        scenes: list[dict[str, str]] = []
        for index, narration in enumerate(parts[:8], start=1):
            scenes.append(
                {
                    "id": f"scene-{index:03d}",
                    "title": f"Scene {index}",
                    "caption": narration[:48],
                    "narration": narration,
                }
            )
        return scenes
