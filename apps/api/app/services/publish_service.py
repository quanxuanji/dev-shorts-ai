import json
from pathlib import Path


class PublishService:
    async def publish(self, platform: str) -> dict[str, str]:
        return {
            "platform": platform,
            "status": "scheduled",
            "publisher": "Playwright adapter placeholder",
            "url": f"mock://publish/{platform}/devshorts-ai",
        }

    def skip(self, output_dir: Path) -> tuple[None, list[str]]:
        marker = output_dir / "publish_skipped.txt"
        marker.write_text("Publish skipped in semi-real MVP.\n", encoding="utf-8")
        return None, ["[Publisher] skipped; Playwright publishing remains a mock adapter."]

    def create_draft(
        self,
        *,
        output_dir: Path,
        final_video: Path,
        title_cover_path: Path,
    ) -> tuple[Path, list[str], dict[str, object]]:
        manifest = {
            "status": "draft_ready",
            "publisher": "Playwright adapter placeholder",
            "platforms": ["douyin", "bilibili", "xiaohongshu"],
            "finalVideo": str(final_video),
            "titleCover": str(title_cover_path),
            "requiresManualConfirmation": True,
            "nextAction": "Open the publishing assistant when real platform login is configured.",
        }
        path = output_dir / "publish_draft.json"
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return path, [f"[Publisher] prepared assisted publish draft at {path}"], manifest
