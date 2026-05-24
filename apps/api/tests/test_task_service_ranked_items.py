import unittest

from app.services.task_service import TaskService


class TaskServiceRankedItemsTest(unittest.TestCase):
    def test_extracts_and_applies_top8_project_metadata(self):
        service = TaskService()
        reference = (
            '固定mock数据：[{"rank":1,"name":"OpenHands","description":"开源 AI 软件工程师 Agent",'
            '"growth":"+8.4k stars this week","whyHot":"能自动读代码、改代码、执行命令。",'
            '"tags":["AI Agent","Coding"]}]'
        )
        scenes = [{"title": "TOP1 OpenHands", "caption": "开源AI工程师", "narration": "第一，OpenHands。"}]

        enriched = service._apply_ranked_project_metadata(scenes, reference)

        self.assertEqual("OpenHands", enriched[0]["name"])
        self.assertEqual(1, enriched[0]["rank"])
        self.assertEqual("+8.4k stars this week", enriched[0]["growth"])
        self.assertEqual(["AI Agent", "Coding"], enriched[0]["tags"])


if __name__ == "__main__":
    unittest.main()
