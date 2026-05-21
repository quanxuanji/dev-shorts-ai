import json
import re
from pathlib import Path


class TitleCoverService:
    def generate(
        self,
        *,
        script: str,
        topic: str | None,
        target_style: str | None,
        output_dir: Path,
    ) -> tuple[Path, list[str], dict[str, object]]:
        subject = topic or "DevShorts AI"
        compact_subject = re.sub(r"\s+", " ", subject).strip()
        titles = [
            f"{compact_subject}：一键生成 AI 短视频",
            f"程序员别再手剪视频了",
            f"把技术视频变成爆款口播稿",
        ]
        cover_prompts = [
            f"深色 AI 控制台界面，中央大字「{compact_subject}」，紫蓝霓虹光效，9:16 竖版封面",
            "开发者 AI 视频流水线工作台，发光 workflow 节点，科技感短视频封面",
            "终端日志、GPU 曲线、final.mp4 输出卡片，赛博风中文技术视频封面",
        ]
        hashtags = ["#AI工具", "#程序员", "#短视频自动化", "#开源项目", "#DevShortsAI"]
        manifest = {
            "title": titles[0],
            "titleVariants": titles,
            "coverPrompts": cover_prompts,
            "hashtags": hashtags,
            "targetStyle": target_style or "中文开发者短视频",
            "description": self._description(script),
            "publishStatus": "draft_ready",
        }
        path = output_dir / "title_cover.json"
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return path, [f"[TitleCover] generated title and cover draft at {path}"], manifest

    def _description(self, script: str) -> str:
        cleaned = re.sub(r"\s+", " ", script).strip()
        if len(cleaned) <= 90:
            return cleaned
        return f"{cleaned[:88]}..."
