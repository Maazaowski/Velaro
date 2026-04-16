"""System and model management endpoints."""

import os
import json
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

system_router = APIRouter()

MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)


class ModelConfig(BaseModel):
    name: str
    architecture: str = "transformer"
    hidden_size: int = 768
    num_layers: int = 12
    num_attention_heads: int = 12
    vocab_size: int = 50257
    context_length: int = 1024
    intermediate_size: int = 3072


class SystemStats(BaseModel):
    cpu_percent: float
    ram_percent: float
    ram_used_gb: float
    ram_total_gb: float
    gpu_available: bool
    gpu_name: str | None = None
    gpu_utilization: float | None = None
    gpu_memory_used_gb: float | None = None
    gpu_memory_total_gb: float | None = None
    gpu_temperature: float | None = None


@system_router.get("/stats", response_model=SystemStats)
async def get_system_stats():
    """Get current system resource usage."""
    import psutil

    ram = psutil.virtual_memory()
    stats = {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "ram_percent": ram.percent,
        "ram_used_gb": round(ram.used / (1024**3), 1),
        "ram_total_gb": round(ram.total / (1024**3), 1),
        "gpu_available": False,
    }

    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]
            stats.update({
                "gpu_available": True,
                "gpu_name": gpu.name,
                "gpu_utilization": gpu.load * 100,
                "gpu_memory_used_gb": round(gpu.memoryUsed / 1024, 1),
                "gpu_memory_total_gb": round(gpu.memoryTotal / 1024, 1),
                "gpu_temperature": gpu.temperature,
            })
    except Exception:
        pass

    return SystemStats(**stats)


@system_router.get("/models")
async def list_models():
    """List all saved models."""
    models = []
    if MODELS_DIR.exists():
        for model_dir in MODELS_DIR.iterdir():
            config_path = model_dir / "config.json"
            if config_path.exists():
                with open(config_path) as f:
                    config = json.load(f)
                models.append(config)
    return {"models": models}


@system_router.post("/models")
async def create_model(config: ModelConfig):
    """Create a new model configuration."""
    model_dir = MODELS_DIR / config.name
    model_dir.mkdir(exist_ok=True)

    config_dict = config.model_dump()
    config_dict["status"] = "draft"

    with open(model_dir / "config.json", "w") as f:
        json.dump(config_dict, f, indent=2)

    return {"message": f"Model '{config.name}' created", "config": config_dict}
