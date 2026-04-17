"""Fine-tuning API — LoRA fine-tuning of existing Velaro models."""

import json
import logging
import threading
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
finetune_router = APIRouter()

MODELS_DIR = Path("./models")

# Track active fine-tune jobs: model_name → latest status dict
_finetune_jobs: dict[str, dict[str, Any]] = {}


class FinetuneRequest(BaseModel):
    base_model: str                             # existing model in ./models/
    new_model_name: str                         # output model name
    # Dataset
    dataset_source: str = "paste"               # "local" | "paste" | "huggingface"
    dataset_value: str = ""
    # LoRA
    lora_rank: int = 8
    lora_alpha: float = 16.0
    lora_dropout: float = 0.05
    target_modules: list[str] = ["c_attn", "c_proj"]
    # Hyperparams
    learning_rate: float = 2e-4
    epochs: int = 3
    batch_size: int = 4
    max_length: int = 512


@finetune_router.post("/start")
async def start_finetune(req: FinetuneRequest):
    """Start a LoRA fine-tuning job in a background thread."""
    base_dir = MODELS_DIR / req.base_model
    if not (base_dir / "config.json").exists():
        return {"error": f"Base model '{req.base_model}' not found"}

    new_dir = MODELS_DIR / req.new_model_name
    if new_dir.exists():
        return {"error": f"A model named '{req.new_model_name}' already exists"}

    with open(base_dir / "config.json") as f:
        base_config = json.load(f)

    # Validate we can import the engine
    try:
        import torch
        from engine.model import VelaroGPT
        from engine.lora import inject_lora, freeze_base_weights, get_lora_params
        from engine.dataset import load_dataset_from_source, create_dataloader
        from engine.checkpoint import load_checkpoint
        from engine.trainer import Trainer, TrainingConfig
    except ImportError as e:
        return {"error": f"Missing dependency: {e}"}

    # Build base model
    try:
        model = VelaroGPT.from_config_dict(base_config)
        ckpt = load_checkpoint(req.base_model)
        if ckpt:
            model.load_state_dict(ckpt["model_state_dict"], strict=False)
    except Exception as e:
        return {"error": f"Failed to load base model: {e}"}

    # Inject LoRA and freeze base weights
    inject_lora(model, rank=req.lora_rank, alpha=req.lora_alpha,
                dropout=req.lora_dropout, target_modules=req.target_modules)
    freeze_base_weights(model)

    lora_params = get_lora_params(model)
    if not lora_params:
        return {"error": "No LoRA parameters injected — check target_modules names"}

    lora_count = sum(p.numel() for p in lora_params)

    # Load dataset
    try:
        dataset = load_dataset_from_source(
            req.dataset_source, req.dataset_value, max_length=req.max_length
        )
    except Exception as e:
        return {"error": f"Dataset error: {e}"}

    dataloader = create_dataloader(dataset, batch_size=req.batch_size, shuffle=True)

    # Prepare output model directory with config
    new_dir.mkdir(parents=True, exist_ok=True)
    new_config = {
        **base_config,
        "name": req.new_model_name,
        "status": "training",
        "base_model": req.base_model,
        "lora_rank": req.lora_rank,
        "lora_alpha": req.lora_alpha,
        "source": "finetune",
    }
    with open(new_dir / "config.json", "w") as f:
        json.dump(new_config, f, indent=2)

    # Training config — only LoRA params will be updated by Trainer
    precision = "fp16" if torch.cuda.is_available() else "fp32"
    train_cfg = TrainingConfig(
        model_name=req.new_model_name,
        learning_rate=req.learning_rate,
        epochs=req.epochs,
        batch_size=req.batch_size,
        precision=precision,
    )

    _finetune_jobs[req.new_model_name] = {"status": "starting", "lora_params": lora_count}

    def _on_metrics(metrics):
        _finetune_jobs[req.new_model_name] = {
            "status": "training",
            "metrics": metrics.__dict__,
        }

    trainer = Trainer(
        model=model,
        train_loader=dataloader,
        config=train_cfg,
        on_metrics=_on_metrics,
    )

    def _run():
        try:
            trainer.start()
            # Mark as ready when done
            cfg_path = new_dir / "config.json"
            with open(cfg_path) as f:
                cfg = json.load(f)
            cfg["status"] = "ready"
            with open(cfg_path, "w") as f:
                json.dump(cfg, f, indent=2)
            _finetune_jobs[req.new_model_name] = {"status": "complete"}
            logger.info(f"Fine-tuning complete: {req.new_model_name}")
        except Exception as exc:
            _finetune_jobs[req.new_model_name] = {"status": "failed", "error": str(exc)}
            logger.error(f"Fine-tuning failed: {exc}")

    t = threading.Thread(target=_run, daemon=True, name=f"finetune-{req.new_model_name}")
    t.start()

    return {
        "success": True,
        "message": f"Fine-tuning started: {req.base_model} → {req.new_model_name}",
        "lora_params": lora_count,
    }


@finetune_router.get("/status/{model_name}")
async def finetune_status(model_name: str):
    """Get the status of a fine-tuning job."""
    return _finetune_jobs.get(model_name, {"status": "not_found"})


@finetune_router.post("/stop/{model_name}")
async def stop_finetune(model_name: str):
    """Mark a fine-tune job for stopping (best-effort)."""
    if model_name not in _finetune_jobs:
        return {"error": f"No active fine-tune job for '{model_name}'"}
    _finetune_jobs[model_name]["status"] = "stopping"
    return {"success": True}
