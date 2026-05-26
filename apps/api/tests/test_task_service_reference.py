import tempfile
import unittest
from pathlib import Path

from app.models import CreateTaskRequest
from app.services.task_service import TaskService


class TaskServiceReferenceTest(unittest.TestCase):
    def test_topic_is_used_as_reference_before_style_prompt(self):
        service = TaskService()
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_text, reference_artifact, logs, _metadata = service._prepare_reference(
                CreateTaskRequest(
                    topic="本周 GitHub 最值得关注的 8 个 AI 项目",
                    script_prompt="中文技术口播，节奏快，像 GitHub 爆款项目拆解。",
                ),
                Path(temp_dir),
            )

        self.assertEqual("本周 GitHub 最值得关注的 8 个 AI 项目", reference_text)
        self.assertEqual("prompt", reference_artifact["kind"])
        self.assertTrue(any("topic/script prompt" in log for log in logs))


if __name__ == "__main__":
    unittest.main()
