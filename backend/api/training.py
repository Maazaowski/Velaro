"""Training management endpoints with WebSocket for live metric streaming."""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from engine.trainer import Trainer, TrainingConfig

logger = logging.getLogger(__name__)
training_router = APIRouter()

# Active trainers keyed by model name
_trainers: dict[str, Trainer] = {}
# WebSocket connections per model
_ws_clients: dict[str, list[WebSocket]] = {}


class TrainingRequest(BaseModel):
    model_name: str
    architecture: str = "transformer"
    # Model config
    hidden_size: int = 768
    num_layers: int = 12
    num_attention_heads: int = 12
    vocab_size: int = 50257
    context_length: int = 1024
    intermediate_size: int = 3072
    # Dataset
    dataset_source: str = "paste"
    dataset_path_or_id: str = "Hello world. This is a test dataset for training."
    tokenizer: str = "bpe"
    # Training
    epochs: int = 10
    batch_size: int = 4
    learning_rate: float = 3e-4
    scheduler: str = "cosine"
    optimizer: str = "adamw"
    warmup_steps: int = 100
    weight_decay: float = 0.01
    gradient_accumulation: int = 1
    precision: str = "fp16"
    checkpoint_every_steps: int = 500
    validate_every_steps: int = 250


def _broadcast_metrics(model_name: str, metrics: dict):
    """Push metrics to all connected WebSocket clients for a model."""
    clients = _ws_clients.get(model_name, [])
    if not clients:
        return
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    dead = []
    for ws in clients:
        try:
            loop.run_until_complete(ws.send_json(metrics))
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)
    loop.close()


@training_router.post("/start")
async def start_training(request: TrainingRequest):
    """Start training a model."""
    if request.model_name in _trainers and _trainers[request.model_name].is_alive():
        return {"error": f"Training already running for '{request.model_name}'"}

    cfg = TrainingConfig(
        model_name=request.model_name,
        architecture=request.architecture,
        hidden_size=request.hidden_size,
        num_layers=request.num_layers,
        num_attention_heads=request.num_attention_heads,
        vocab_size=request.vocab_size,
        context_length=request.context_length,
        intermediate_size=request.intermediate_size,
        dataset_source=request.dataset_source,
        dataset_path_or_id=request.dataset_path_or_id,
        tokenizer=request.tokenizer,
        epochs=request.epochs,
        batch_size=request.batch_size,
        learning_rate=request.learning_rate,
        scheduler=request.scheduler,
        optimizer=request.optimizer,
        warmup_steps=request.warmup_steps,
        weight_decay=request.weight_decay,
        gradient_accumulation=request.gradient_accumulation,
        precision=request.precision,
        checkpoint_every_steps=request.checkpoint_every_steps,
        validate_every_steps=request.validate_every_steps,
    )

    def on_metrics(metrics: dict):
        _broadcast_metrics(request.model_name, metrics)

    trainer = Trainer(cfg, on_metrics=on_metrics)
    _trainers[request.model_name] = trainer
    _ws_clients.setdefault(request.model_name, [])
    trainer.start()

    logger.info(f"Training started for '{request.model_name}'")
    return {"message": f"Training started for '{request.model_name}'", "status": "running"}


@training_router.post("/{model_name}/pause")
async def pause_training(model_name: str):
    trainer = _trainers.get(model_name)
    if not trainer or not trainer.is_alive():
        return {"error": "No active training found"}
    trainer.pause()
    return {"message": f"Training paused for '{model_name}'", "status": "paused"}


@training_router.post("/{model_name}/resume")
async def resume_training(model_name: str):
    trainer = _trainers.get(model_name)
    if not trainer:
        return {"error": "No training found"}
    trainer.resume()
    return {"message": f"Training resumed for '{model_name}'", "status": "running"}


@training_router.post("/{model_name}/stop")
async def stop_training(model_name: str):
    trainer = _trainers.get(model_name)
    if not trainer or not trainer.is_alive():
        return {"error": "No active training found"}
    trainer.stop()
    return {"message": f"Training stopped for '{model_name}'", "status": "stopping"}


@training_router.get("/active")
async def get_active_trainings():
    """List all active and recent training runs with their current metrics."""
    result = {}
    for name, trainer in _trainers.items():
        result[name] = {
            "alive": trainer.is_alive(),
            "metrics": trainer.metrics.__dict__ if hasattr(trainer.metrics, "__dict__") else {},
        }
    return {"trainings": result}


@training_router.get("/{model_name}/metrics")
async def get_metrics(model_name: str):
    """Get current metrics snapshot for a model."""
    trainer = _trainers.get(model_name)
    if not trainer:
        return {"error": "No training found"}
    from dataclasses import asdict
    return asdict(trainer.metrics)


@training_router.websocket("/ws/{model_name}")
async def training_websocket(websocket: WebSocket, model_name: str):
    """WebSocket endpoint — streams live training metrics to the frontend."""
    await websocket.accept()
    _ws_clients.setdefault(model_name, []).append(websocket)
    logger.info(f"WS client connected for '{model_name}'")
    try:
        # Send current snapshot immediately on connect
        trainer = _trainers.get(model_name)
        if trainer:
            from dataclasses import asdict
            await websocket.send_json(asdict(trainer.metrics))

        # Keep alive — metrics are pushed by trainer via on_metrics callback
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send ping
                await websocket.send_json({"ping": True})
    except WebSocketDisconnect:
        logger.info(f"WS client disconnected for '{model_name}'")
    finally:
        clients = _ws_clients.get(model_name, [])
        if websocket in clients:
            clients.remove(websocket)
