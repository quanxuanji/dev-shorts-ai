import re
from pathlib import Path


class SubtitleService:
    def create_subtitles(
        self,
        script: str,
        output_dir: Path,
        duration_seconds: float | None = None,
    ) -> tuple[Path, list[str]]:
        subtitle_path = output_dir / "subtitles.srt"
        chunks = self._chunk_script(script)
        lines: list[str] = []
        total_seconds = duration_seconds or self._estimate_duration_seconds(script, len(chunks))
        cue_seconds = max(2.0, min(4.5, total_seconds / max(len(chunks), 1)))

        for index, chunk in enumerate(chunks, start=1):
            start_seconds = (index - 1) * cue_seconds
            end_seconds = min(start_seconds + cue_seconds, total_seconds)
            lines.extend(
                [
                    str(index),
                    f"{self._timestamp(start_seconds)} --> {self._timestamp(end_seconds)}",
                    chunk,
                    "",
                ]
            )

        subtitle_path.write_text("\n".join(lines), encoding="utf-8")
        source = "voice duration" if duration_seconds else "script estimate"
        return subtitle_path, [f"[Subtitle] wrote {len(chunks)} timed cues using {source} to {subtitle_path}"]

    def _chunk_script(self, script: str) -> list[str]:
        sentences = [part.strip() for part in re.split(r"(?<=[。！？.!?])\s*", script) if part.strip()]
        if not sentences:
            sentences = [script.strip() or "DevShorts AI semi-real MVP pipeline preview."]

        chunks: list[str] = []
        for sentence in sentences:
            if self._contains_cjk(sentence):
                chunks.extend(self._chunk_cjk(sentence))
                continue
            words = sentence.split()
            if len(words) <= 14:
                chunks.append(sentence)
                continue
            for start in range(0, len(words), 12):
                chunks.append(" ".join(words[start : start + 12]))
        return chunks[:12]

    def _chunk_cjk(self, sentence: str) -> list[str]:
        if len(sentence) <= 22:
            return [sentence]
        return [sentence[index : index + 18] for index in range(0, len(sentence), 18)]

    def _contains_cjk(self, value: str) -> bool:
        return bool(re.search(r"[\u4e00-\u9fff]", value))

    def _estimate_duration_seconds(self, script: str, chunk_count: int) -> float:
        cjk_chars = len(re.findall(r"[\u4e00-\u9fff]", script))
        words = len(re.findall(r"[A-Za-z0-9']+", script))
        estimated = (cjk_chars / 4.2) + (words / 2.7)
        return max(float(chunk_count * 2), min(60.0, estimated or 12.0))

    def _timestamp(self, seconds: float) -> str:
        millis = int(round(seconds * 1000))
        hours = millis // 3_600_000
        minutes = (millis % 3_600_000) // 60_000
        secs = (millis % 60_000) // 1000
        ms = millis % 1000
        return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"
