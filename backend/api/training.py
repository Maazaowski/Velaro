"""Training management endpoints with WebSocket for live updates."""

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

training_router = APIRouter()

# In-memory training state (will be replaced with proper state management)
active_trainings: dict = {}


class TrainingRequest(BaseModel):
    model_name: str
    dataset_path: str | None = None
    epochs: int = 10
    batch_size: int = 32
    learning_rate: float = 3e-4
    optimizer: str = "adamw"
    warmup_steps: int = 2000
    weight_decay: float = 0.01
    precision: str = "fp16"
    gradient_accumulation_steps: int = 4


class TrainingStatus(BaseModel):
    model_name: str
    status: str  # "running", "paused", "completed", "failed"
    epoch: int
    total_epochs: int
    step: int
    total_steps: int
    train_loss: float
    val_loss: float | None = None
    learning_rate: float
    tokens_per_second: float
    elapsed_seconds: float
    eta_seconds: float


@training_router.post("/start")
async def start_training(request: TrainingRequest):
    """Start training a model."""
    active_trainings[request.model_name] = {
        "status": "running",
        "config": request.model_dump(),
        "epoch": 0,
        "step": 0,
    }
    return {"message": f"Training started for '{request.model_name}'", "status": "running"}


@training_router.post("/{model_name}/pause")
async def pause_training(model_name: str):
    """Pause an active training run."""
    if model_name in active_trainings:
        active_trainings[model_name]["status"] = "paused"
        return {"message": f"Training paused for '{model_name}'"}
    return {"error": "No active training found"}


@training_router.post("/{model_name}/stop")
async def stop_training(model_name: str):
    """Stop an active training run."""
    if model_name in active_trainings:
        del active_trainings[model_name]
        return {"message": f"Training stopped for '{model_name}'"}
    return {"error": "No active training found"}


@training_router.get("/active")
async def get_active_trainings():
    """List all active training runs."""
    return {"trainings": active_trainings}


@training_router.websocket("/ws/{model_name}")
async def training_websocket(websocket: WebSocket, model_name: str):
    """WebSocket endpoint for live training metrics."""
    await websocket.accept()
    try:
        while True:
            if model_name in active_trainings:
                training = active_trainings[model_name]
                await websocket.send_json(training)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
