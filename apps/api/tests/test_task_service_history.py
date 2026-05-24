import tempfile
import unittest
from pathlib import Path

from app.core.config import settings
from app.services.task_service import TaskService


class TaskServiceHistoryTest(unittest.TestCase):
    def test_recent_tasks_includes_completed_artifact_directories(self):
        original_artifacts_dir = settings.artifacts_dir
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                output_root = Path(temp_dir) / "outputs"
                task_dir = output_root / "task-from-disk"
                task_dir.mkdir(parents=True)
                (task_dir / "final.mp4").write_bytes(b"video")
                (task_dir / "voice.wav").write_bytes(b"audio")
                (task_dir / "voiceover_script.txt").write_text("历史口播", encoding="utf-8")
                (task_dir / "render_manifest.json").write_text("{}", encoding="utf-8")
                settings.artifacts_dir = str(output_root)

                service = TaskService()
                recent = service.recent_tasks()

            self.assertEqual(1, len(recent))
            task = recent[0]
            self.assertEqual("task-from-disk", task.id)
            self.assertEqual("success", task.status)
            self.assertEqual("/artifacts/outputs/task-from-disk/final.mp4", task.artifacts["finalVideoUrl"])
            self.assertEqual("/artifacts/outputs/task-from-disk/voice.wav", task.artifacts["audioUrl"])
            self.assertEqual("历史口播", task.artifacts["voiceoverScript"])
            self.assertTrue(all(step.status == "success" for step in task.steps))
        finally:
            settings.artifacts_dir = original_artifacts_dir


if __name__ == "__main__":
    unittest.main()
