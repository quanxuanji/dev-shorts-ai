from pathlib import Path


class DigitalHumanService:
    async def generate(self, audio_url: str) -> dict[str, str]:
        return {
            "avatar_video": "mock://video/digital-human-lipsync.mp4",
            "engine": "LatentSync/Wav2Lip adapter placeholder",
            "audio_url": audio_url,
        }

    def skip(self, output_dir: Path) -> tuple[None, list[str]]:
        marker = output_dir / "digital_human_skipped.txt"
        marker.write_text("Digital human skipped in semi-real MVP.\n", encoding="utf-8")
        return None, ["[DigitalHuman] skipped in semi-real MVP; LatentSync/Wav2Lip adapters remain reserved."]
