import tempfile
import unittest
from pathlib import Path

from app.services.subtitle_service import SubtitleService


class SubtitleServiceTest(unittest.TestCase):
    def test_chunks_keep_ai_and_mcp_tokens_together(self):
        service = SubtitleService()

        chunks = service._chunk_script("GitHub 本周最火 AI 项目。FastMCP 让 AI 连接 MCP 服务器。")

        self.assertIn("GitHub 本周最火 AI 项目。", chunks)
        self.assertIn("FastMCP 让 AI 连接 MCP 服务器。", chunks)
        self.assertFalse(any(chunk in {"A", "I", "MC", "P"} for chunk in chunks))

    def test_subtitles_cover_full_duration(self):
        service = SubtitleService()
        script = "第一，OpenHands 开源 AI 工程师。第二，FastMCP 连接工具系统。第三，Ollama 本地运行大模型。"

        with tempfile.TemporaryDirectory() as temp_dir:
            subtitle_path, _ = service.create_subtitles(script, Path(temp_dir), duration_seconds=12.0)
            content = subtitle_path.read_text(encoding="utf-8")
        self.assertIn("00:00:12,000", content)

    def test_top8_script_keeps_late_items(self):
        service = SubtitleService()
        script = (
            "想了解本周 GitHub 最火的 AI 项目吗？开发者的工具箱必须更新！"
            "第一，OpenHands，开源 AI 工程师，能自动读改代码并执行命令。"
            "第二，Claude Code，命令行编程助手，把需求测试一气呵成。"
            "第三，FastMCP，快速构建 MCP 服务器，让 AI 轻松连接各种系统。"
            "第四，Mem0，为 AI 加上长期记忆，记住用户和上下文。"
            "第五，Cursor Rules Hub，沉淀团队的 AI 编码规范。"
            "第六，Ollama，本地运行大模型，兼顾隐私与成本。"
            "第七，ComfyUI，节点式工作流，串联 AI 视频创作。"
            "第八，n8n AI Workflow，自动化流程接入智能体，提升生产力。"
            "这些工具正在改变开发方式。想看下一期榜单？评论区扣1告诉我。DevShorts AI 自动生成。"
        )

        chunks = service._chunk_script(script)

        self.assertTrue(any("Ollama" in chunk for chunk in chunks))
        self.assertTrue(any("ComfyUI" in chunk for chunk in chunks))
        self.assertTrue(any("n8n AI Workflow" in chunk for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
