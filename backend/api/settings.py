"""Settings API — save and load application settings."""

import json
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

settings_router = APIRouter()
SETTINGS_FILE = Path("./settings.json")

class AppSettings(BaseModel):
    # Compute
    device: str = "auto"           # "auto" | "cpu" | "cuda" | "mps"
    precision: str = "fp16"        # "fp32" | "fp16" | "bf16"
    max_gpu_memory_percent: int = 90
    # General
    auto_save_interval: int = 5    # minutes
    log_level: str = "INFO"        # "DEBUG" | "INFO" | "WARN" | "ERROR"
    models_dir: str = "./models"
    exports_dir: str = "./exports"
    # Notifications
    notify_training_complete: bool = True
    notify_errors: bool = True
    # Appearance
    theme: str = "dark"            # "dark" | "light"

@settings_router.get("")
async def get_settings():
    """Load settings from disk."""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE) as f:
            data = json.load(f)
        return AppSettings(**data)
    return AppSettings()

@settings_router.post("")
async def save_settings(settings: AppSettings):
    """Save settings to disk."""
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings.model_dump(), f, indent=2)
    return {"success": True, "settings": settings.model_dump()}
