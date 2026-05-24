from app.providers.base import LLMProvider, SpeechProvider


class MockProvider(LLMProvider, SpeechProvider):
    async def rewrite_script(
        self,
        script: str,
        topic: str | None = None,
        target_style: str | None = None,
        speaking_style: str | None = None,
    ) -> str:
        subject = topic or "DevShorts AI"
        target = target_style or "developer short video"
        style = speaking_style or "clear technical"
        return (
            f"开场：还在手剪技术视频吗？现在用 DevShorts AI，把「{subject}」直接变成一条{target}。"
            f"它会先准备视频源、抽取音频，再转写内容，并按「{style}」风格重写成口播稿。"
            "接着自动生成字幕和语音，最后用 ffmpeg 合成 final.mp4。"
            "这一版先保留数字人和发布接口，方便后续替换成真实模型。"
        )

    async def synthesize(self, script: str, voice: str) -> str:
        return f"mock://audio/{voice}/devshorts-demo.wav"
