from pathlib import Path
import mimetypes

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import health, models, settings as settings_routes, studio, system, tasks, voices, workflow
from app.core.config import settings

app = FastAPI(
    title="DevShorts AI API",
    description="Mock-first API for the DevShorts AI short-video workflow studio.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])
app.include_router(voices.router, prefix="/api/voices", tags=["voices"])
app.include_router(workflow.router, prefix="/api/workflow", tags=["workflow"])

artifacts_path = Path(settings.artifacts_dir).parent
Path(settings.artifacts_dir).mkdir(parents=True, exist_ok=True)


def _artifact_path(file_path: str) -> Path:
    root = artifacts_path.resolve()
    target = (root / file_path).resolve()
    if root != target and root not in target.parents:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return target


def _parse_range(range_header: str, file_size: int) -> tuple[int, int] | None:
    if not range_header.startswith("bytes="):
        return None
    value = range_header.removeprefix("bytes=").split(",", 1)[0].strip()
    if "-" not in value:
        return None
    start_text, end_text = value.split("-", 1)
    if not start_text and not end_text:
        return None
    if start_text:
        start = int(start_text)
        end = int(end_text) if end_text else file_size - 1
    else:
        suffix_length = int(end_text)
        start = max(0, file_size - suffix_length)
        end = file_size - 1
    if start >= file_size or end < start:
        return None
    return start, min(end, file_size - 1)


def _iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024):
    with path.open("rb") as handle:
        handle.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = handle.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@app.get("/artifacts/{file_path:path}")
@app.head("/artifacts/{file_path:path}")
async def artifact_file(file_path: str, request: Request):
    path = _artifact_path(file_path)
    file_size = path.stat().st_size
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    headers = {"Accept-Ranges": "bytes"}
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path, media_type=media_type, headers=headers)

    byte_range = _parse_range(range_header, file_size)
    if byte_range is None:
        return StreamingResponse(
            iter(()),
            status_code=416,
            media_type=media_type,
            headers={
                **headers,
                "Content-Range": f"bytes */{file_size}",
            },
        )

    start, end = byte_range
    content_length = end - start + 1
    return StreamingResponse(
        _iter_file_range(path, start, end),
        status_code=206,
        media_type=media_type,
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(content_length),
        },
    )


app.mount("/artifacts", StaticFiles(directory=artifacts_path), name="artifacts")
