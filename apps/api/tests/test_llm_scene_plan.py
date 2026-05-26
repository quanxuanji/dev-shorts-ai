import asyncio
import unittest
from unittest.mock import patch

from app.models import RuntimeSettings
from app.services.llm_service import LLMService


class FakeJSONProvider:
    async def rewrite_script(self, script, topic=None, target_style=None, speaking_style=None):
        return """
```json
{
  "scenes": [
    {
      "title": "先抓住痛点",
      "caption": "手剪技术视频太慢",
      "narration": "如果你还在手动剪技术短视频，真正浪费的不是剪辑时间。"
    },
    {
      "title": "给出自动化链路",
      "caption": "脚本、声音、画面一起生成",
      "narration": "DevShorts AI 会把想法拆成口播，再生成音频和时间线。"
    }
  ]
}
```
"""


class FakeScriptProvider:
    async def rewrite_script(self, script, topic=None, target_style=None, speaking_style=None):
        return "这是模型生成的口播稿。"


class FakeBrokenProvider:
    async def rewrite_script(self, script, topic=None, target_style=None, speaking_style=None):
        return "这不是 JSON，但也应该 fallback。"


class LLMScenePlanTest(unittest.TestCase):
    def test_voiceover_prompt_warns_against_fake_project_lists(self):
        service = LLMService()
        prompt = service._build_voiceover_context(
            "本周 GitHub 最值得关注的 8 个 AI 项目",
            topic="本周 GitHub 最值得关注的 8 个 AI 项目",
            target_style="中文技术口播",
            speaking_style="tech",
            script_prompt=None,
        )

        self.assertIn("不要编造项目名", prompt)
        self.assertIn("不要用“模型压缩工具”“自动化工作流”这类泛泛类别冒充具体项目", prompt)
        self.assertIn("缺少项目清单", prompt)

    def test_non_mock_voiceover_script_provider_returns_script_and_logs(self):
        service = LLMService()
        with patch("app.services.llm_service.settings_service.get", return_value=RuntimeSettings(llm_provider="openai")):
            service._select_provider = lambda *_args: FakeScriptProvider()
            script, logs = asyncio.run(
                service.generate_voiceover_script_with_logs(
                    "参考资料",
                    topic="AI 短视频",
                )
            )

        self.assertEqual("这是模型生成的口播稿。", script)
        self.assertTrue(any("Chinese voiceover script generated" in log for log in logs))

    def test_parses_json_scene_plan_from_provider_response(self):
        service = LLMService()
        with patch("app.services.llm_service.settings_service.get", return_value=RuntimeSettings(llm_provider="openai")):
            service._select_provider = lambda *_args: FakeJSONProvider()
            scenes, logs = asyncio.run(
                service.generate_scene_plan_with_logs(
                    "如果你还在手动剪技术短视频。DevShorts AI 会自动生成。",
                    topic="AI 短视频",
                )
            )

        self.assertEqual(2, len(scenes))
        self.assertEqual("先抓住痛点", scenes[0]["title"])
        self.assertEqual("手剪技术视频太慢", scenes[0]["caption"])
        self.assertTrue(scenes[0]["narration"].startswith("如果你还在"))
        self.assertTrue(any("structured scene plan generated" in log for log in logs))

    def test_falls_back_to_local_scene_plan_when_provider_returns_invalid_json(self):
        service = LLMService()
        with patch("app.services.llm_service.settings_service.get", return_value=RuntimeSettings(llm_provider="openai")):
            service._select_provider = lambda *_args: FakeBrokenProvider()
            scenes, logs = asyncio.run(
                service.generate_scene_plan_with_logs(
                    "第一幕说明问题。第二幕说明方案。第三幕说明结果。",
                    topic="AI 短视频",
                )
            )

        self.assertEqual(3, len(scenes))
        self.assertEqual("Scene 1", scenes[0]["title"])
        self.assertEqual("第一幕说明问题。", scenes[0]["narration"])
        self.assertTrue(any("fallback" in log.lower() for log in logs))


if __name__ == "__main__":
    unittest.main()
