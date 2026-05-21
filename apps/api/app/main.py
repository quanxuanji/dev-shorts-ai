from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import health, models, settings as settings_routes, system, tasks, workflow
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
app.include_router(workflow.router, prefix="/api/workflow", tags=["workflow"])

artifacts_path = Path(settings.artifacts_dir).parent
Path(settings.artifacts_dir).mkdir(parents=True, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=artifacts_path), name="artifacts")
