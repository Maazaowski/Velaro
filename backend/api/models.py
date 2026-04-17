"""System and model management endpoints."""

import os
import json
import shutil
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


class RenameRequest(BaseModel):
    new_name: str


class CloneRequest(BaseModel):
    new_name: str


class HuggingFaceImportRequest(BaseModel):
    model_id: str
    local_name: str


class LocalImportRequest(BaseModel):
    file_path: str
    model_name: str
    architecture: str


class StatusUpdateRequest(BaseModel):
    status: str


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


@system_router.delete("/models/{name}")
async def delete_model(name: str):
    """Delete a model directory and all its contents."""
    model_dir = MODELS_DIR / name
    if not model_dir.exists():
        return {"error": f"Model '{name}' not found"}
    try:
        shutil.rmtree(model_dir)
        return {"success": True}
    except Exception as e:
        return {"error": f"Failed to delete model '{name}': {e}"}


@system_router.patch("/models/{name}/rename")
async def rename_model(name: str, body: RenameRequest):
    """Rename a model directory and update its config.json."""
    model_dir = MODELS_DIR / name
    if not model_dir.exists():
        return {"error": f"Model '{name}' not found"}

    new_dir = MODELS_DIR / body.new_name
    if new_dir.exists():
        return {"error": f"A model named '{body.new_name}' already exists"}

    try:
        model_dir.rename(new_dir)
        config_path = new_dir / "config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
            config["name"] = body.new_name
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
        return {"success": True, "new_name": body.new_name}
    except Exception as e:
        return {"error": f"Failed to rename model: {e}"}


@system_router.post("/models/{name}/clone")
async def clone_model(name: str, body: CloneRequest):
    """Clone a model config under a new name."""
    source_dir = MODELS_DIR / name
    if not source_dir.exists():
        return {"error": f"Model '{name}' not found"}

    dest_dir = MODELS_DIR / body.new_name
    if dest_dir.exists():
        return {"error": f"A model named '{body.new_name}' already exists"}

    try:
        shutil.copytree(source_dir, dest_dir)
        config_path = dest_dir / "config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
            config["name"] = body.new_name
            config["status"] = "draft"
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)
        return {"success": True, "new_name": body.new_name}
    except Exception as e:
        return {"error": f"Failed to clone model: {e}"}


@system_router.post("/models/import/huggingface")
async def import_huggingface(body: HuggingFaceImportRequest):
    """Import a model from HuggingFace Hub via snapshot_download."""
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        return {"error": "huggingface_hub is not installed. Run: pip install huggingface_hub"}

    dest_dir = MODELS_DIR / body.local_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    try:
        snapshot_download(repo_id=body.model_id, local_dir=str(dest_dir))
    except Exception as e:
        # Clean up empty dir if download failed
        try:
            if dest_dir.exists() and not any(dest_dir.iterdir()):
                dest_dir.rmdir()
        except Exception:
            pass
        return {"error": f"HuggingFace download failed: {e}"}

    config = {
        "name": body.local_name,
        "architecture": "transformer",
        "status": "ready",
        "source": "huggingface",
        "model_id": body.model_id,
    }
    with open(dest_dir / "config.json", "w") as f:
        json.dump(config, f, indent=2)

    return {"success": True, "local_name": body.local_name, "model_id": body.model_id}


@system_router.post("/models/import/local")
async def import_local(body: LocalImportRequest):
    """Import a local checkpoint file into the models directory."""
    source_path = Path(body.file_path)
    if not source_path.exists():
        return {"error": f"File not found: {body.file_path}"}
    if not source_path.is_file():
        return {"error": f"Path is not a file: {body.file_path}"}

    dest_dir = MODELS_DIR / body.model_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    try:
        shutil.copy2(source_path, dest_dir / source_path.name)
    except Exception as e:
        return {"error": f"Failed to copy checkpoint: {e}"}

    config = {
        "name": body.model_name,
        "architecture": body.architecture,
        "status": "ready",
        "source": "local",
        "checkpoint_file": source_path.name,
    }
    with open(dest_dir / "config.json", "w") as f:
        json.dump(config, f, indent=2)

    return {"success": True, "model_name": body.model_name}


@system_router.patch("/models/{name}/status")
async def update_model_status(name: str, body: StatusUpdateRequest):
    """Update the status field in a model's config.json."""
    config_path = MODELS_DIR / name / "config.json"
    if not config_path.exists():
        return {"error": f"Model '{name}' not found"}

    try:
        with open(config_path) as f:
            config = json.load(f)
        config["status"] = body.status
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        return {"success": True, "name": name, "status": body.status}
    except Exception as e:
        return {"error": f"Failed to update status: {e}"}
