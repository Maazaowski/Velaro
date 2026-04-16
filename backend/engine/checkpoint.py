"""Checkpoint save and load utilities."""

import json
import logging
from pathlib import Path

import torch

logger = logging.getLogger(__name__)

CHECKPOINTS_DIR = Path("./checkpoints")


def save_checkpoint(
    model,
    optimizer,
    step: int,
    epoch: int,
    train_loss: float,
    val_loss: float | None,
    model_name: str,
    is_best: bool = False,
) -> Path:
    """Save a training checkpoint."""
    model_dir = CHECKPOINTS_DIR / model_name
    model_dir.mkdir(parents=True, exist_ok=True)

    state = {
        "step": step,
        "epoch": epoch,
        "train_loss": train_loss,
        "val_loss": val_loss,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "model_config": vars(model.config),
    }

    path = model_dir / f"step-{step:07d}.pt"
    torch.save(state, path)
    logger.info(f"Checkpoint saved: {path}")

    if is_best:
        best_path = model_dir / "best.pt"
        torch.save(state, best_path)
        logger.info(f"New best model saved (val_loss={val_loss:.4f})")

    # Keep only last 3 regular checkpoints (not best)
    checkpoints = sorted(model_dir.glob("step-*.pt"))
    for old in checkpoints[:-3]:
        old.unlink()

    return path


def load_checkpoint(model_name: str, checkpoint: str = "best"):
    """Load a checkpoint. checkpoint='best' or 'latest' or a step number."""
    model_dir = CHECKPOINTS_DIR / model_name

    if checkpoint == "best":
        path = model_dir / "best.pt"
    elif checkpoint == "latest":
        paths = sorted(model_dir.glob("step-*.pt"))
        if not paths:
            return None
        path = paths[-1]
    else:
        path = model_dir / f"step-{int(checkpoint):07d}.pt"

    if not path.exists():
        logger.warning(f"Checkpoint not found: {path}")
        return None

    state = torch.load(path, map_location="cpu", weights_only=False)
    logger.info(f"Loaded checkpoint: {path} (step={state['step']}, loss={state['train_loss']:.4f})")
    return state


def list_checkpoints(model_name: str) -> list[dict]:
    """List all checkpoints for a model."""
    model_dir = CHECKPOINTS_DIR / model_name
    if not model_dir.exists():
        return []
    checkpoints = []
    for p in sorted(model_dir.glob("*.pt")):
        try:
            state = torch.load(p, map_location="cpu", weights_only=True)
            checkpoints.append({
                "file": p.name,
                "step": state.get("step", 0),
                "epoch": state.get("epoch", 0),
                "train_loss": state.get("train_loss", 0),
                "val_loss": state.get("val_loss"),
            })
        except Exception:
            pass
    return checkpoints
