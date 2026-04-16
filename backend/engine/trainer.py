"""Core training loop with real-time metric streaming."""

import asyncio
import logging
import math
import time
import threading
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable

import torch
import torch.nn as nn

from engine.model import VelaroGPT
from engine.dataset import load_dataset_from_source, create_dataloader
from engine.checkpoint import save_checkpoint, load_checkpoint

logger = logging.getLogger(__name__)


@dataclass
class TrainingMetrics:
    model_name: str = ""
    status: str = "idle"           # idle | running | paused | completed | failed | stopping
    epoch: int = 0
    total_epochs: int = 0
    step: int = 0
    total_steps: int = 0
    progress_pct: float = 0.0
    train_loss: float = 0.0
    val_loss: float | None = None
    best_val_loss: float | None = None
    learning_rate: float = 0.0
    grad_norm: float = 0.0
    tokens_per_second: float = 0.0
    elapsed_seconds: float = 0.0
    eta_seconds: float = 0.0
    gpu_temp: float | None = None
    gpu_utilization: float | None = None
    vram_used_gb: float | None = None
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    log_lines: list[str] = field(default_factory=list)
    error: str | None = None


@dataclass
class TrainingConfig:
    model_name: str = "my-model"
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
    dataset_path_or_id: str = ""
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
    # Checkpointing
    checkpoint_every_steps: int = 500
    validate_every_steps: int = 250
    val_split: float = 0.1


class Trainer:
    """Manages the full training lifecycle for a single model."""

    def __init__(self, config: TrainingConfig, on_metrics: Callable[[dict], None] | None = None):
        self.config = config
        self.on_metrics = on_metrics  # callback to push metrics out
        self.metrics = TrainingMetrics(
            model_name=config.model_name,
            status="idle",
            total_epochs=config.epochs,
        )
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._thread: threading.Thread | None = None

    # ──────────────────────────────────────────────────
    # Public control API
    # ──────────────────────────────────────────────────

    def start(self):
        """Start training in a background thread."""
        self._stop_event.clear()
        self._pause_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def pause(self):
        self._pause_event.set()
        self.metrics.status = "paused"
        self._emit()

    def resume(self):
        self._pause_event.clear()
        self.metrics.status = "running"
        self._emit()

    def stop(self):
        self.metrics.status = "stopping"
        self._stop_event.set()
        self._pause_event.clear()

    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    # ──────────────────────────────────────────────────
    # Internal training loop
    # ──────────────────────────────────────────────────

    def _run(self):
        try:
            self._train()
        except Exception as e:
            logger.exception("Training failed")
            self.metrics.status = "failed"
            self.metrics.error = str(e)
            self._emit()

    def _train(self):
        cfg = self.config
        device = self._get_device()
        self._log(f"Using device: {device}")

        # ── Model ──
        self._log(f"Building model '{cfg.model_name}' ({cfg.num_layers} layers, hidden={cfg.hidden_size})")
        model = VelaroGPT.from_config_dict({
            "vocab_size": cfg.vocab_size,
            "context_length": cfg.context_length,
            "hidden_size": cfg.hidden_size,
            "num_layers": cfg.num_layers,
            "num_attention_heads": cfg.num_attention_heads,
            "intermediate_size": cfg.intermediate_size,
        }).to(device)
        param_count = model.count_parameters()
        self._log(f"Model parameters: {param_count:,} ({param_count/1e6:.1f}M)")

        # ── Dataset ──
        self._log(f"Loading dataset (source={cfg.dataset_source})")
        self.metrics.status = "running"
        train_ds, val_ds = load_dataset_from_source(
            source=cfg.dataset_source,
            path_or_id=cfg.dataset_path_or_id,
            context_length=cfg.context_length,
            tokenizer_type=cfg.tokenizer,
            val_split=cfg.val_split,
        )
        train_loader = create_dataloader(train_ds, cfg.batch_size, shuffle=True)
        val_loader = create_dataloader(val_ds, cfg.batch_size, shuffle=False)
        self._log(f"Dataset ready — train: {len(train_ds):,} samples | val: {len(val_ds):,} samples")

        # ── Optimizer ──
        optimizer = self._build_optimizer(model)

        # ── Precision ──
        use_amp = cfg.precision in ("fp16", "bf16") and device.type == "cuda"
        amp_dtype = torch.float16 if cfg.precision == "fp16" else torch.bfloat16
        scaler = torch.amp.GradScaler("cuda") if use_amp and cfg.precision == "fp16" else None

        # ── Scheduler ──
        total_steps = len(train_loader) * cfg.epochs // cfg.gradient_accumulation
        self.metrics.total_steps = total_steps
        scheduler = self._build_scheduler(optimizer, total_steps)

        self._log(f"Training for {cfg.epochs} epochs | {total_steps:,} steps | batch={cfg.batch_size} (eff={cfg.batch_size * cfg.gradient_accumulation})")

        # ── Training loop ──
        global_step = 0
        best_val_loss = float("inf")
        start_time = time.time()
        tokens_processed = 0

        for epoch in range(1, cfg.epochs + 1):
            if self._stop_event.is_set():
                break

            self.metrics.epoch = epoch
            self._log(f"Epoch {epoch}/{cfg.epochs} started")
            model.train()
            optimizer.zero_grad()

            for batch_idx, (x, y) in enumerate(train_loader):
                # ── Pause ──
                while self._pause_event.is_set():
                    time.sleep(0.2)
                    if self._stop_event.is_set():
                        break

                if self._stop_event.is_set():
                    break

                x, y = x.to(device), y.to(device)
                step_start = time.time()

                # Forward pass
                if use_amp:
                    with torch.amp.autocast(device.type, dtype=amp_dtype):
                        _, loss = model(x, y)
                    loss = loss / cfg.gradient_accumulation
                    if scaler:
                        scaler.scale(loss).backward()
                    else:
                        loss.backward()
                else:
                    _, loss = model(x, y)
                    loss = loss / cfg.gradient_accumulation
                    loss.backward()

                tokens_processed += x.numel()

                # Gradient accumulation step
                if (batch_idx + 1) % cfg.gradient_accumulation == 0:
                    if scaler:
                        scaler.unscale_(optimizer)
                    grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item()
                    if scaler:
                        scaler.step(optimizer)
                        scaler.update()
                    else:
                        optimizer.step()
                    scheduler.step()
                    optimizer.zero_grad()
                    global_step += 1

                    step_time = time.time() - step_start
                    elapsed = time.time() - start_time
                    tok_per_sec = tokens_processed / max(elapsed, 1e-6)
                    eta = (total_steps - global_step) * (elapsed / max(global_step, 1))
                    current_lr = scheduler.get_last_lr()[0]

                    # Update metrics
                    self.metrics.step = global_step
                    self.metrics.progress_pct = round(global_step / max(total_steps, 1) * 100, 1)
                    self.metrics.train_loss = round(loss.item() * cfg.gradient_accumulation, 4)
                    self.metrics.learning_rate = round(current_lr, 8)
                    self.metrics.grad_norm = round(grad_norm, 4)
                    self.metrics.tokens_per_second = round(tok_per_sec, 1)
                    self.metrics.elapsed_seconds = round(elapsed, 1)
                    self.metrics.eta_seconds = round(eta, 1)
                    self._update_system_stats()
                    self._emit()

                    if global_step % 10 == 0:
                        self._log(
                            f"Step {global_step:,} | Loss: {self.metrics.train_loss:.4f} | "
                            f"LR: {current_lr:.2e} | GradNorm: {grad_norm:.3f} | "
                            f"{tok_per_sec:.0f} tok/s",
                            level="METRIC",
                        )

                    # Validation
                    if global_step % cfg.validate_every_steps == 0:
                        val_loss = self._validate(model, val_loader, device, use_amp, amp_dtype)
                        self.metrics.val_loss = round(val_loss, 4)
                        is_best = val_loss < best_val_loss
                        if is_best:
                            best_val_loss = val_loss
                            self.metrics.best_val_loss = round(best_val_loss, 4)
                        self._log(
                            f"Validation — loss: {val_loss:.4f} | perplexity: {math.exp(val_loss):.2f}"
                            + (" ✓ New best" if is_best else ""),
                            level="INFO",
                        )
                        save_checkpoint(model, optimizer, global_step, epoch,
                                        self.metrics.train_loss, val_loss,
                                        cfg.model_name, is_best)
                        model.train()

                    # Regular checkpoint
                    elif global_step % cfg.checkpoint_every_steps == 0:
                        save_checkpoint(model, optimizer, global_step, epoch,
                                        self.metrics.train_loss, self.metrics.val_loss,
                                        cfg.model_name, False)

            if self._stop_event.is_set():
                self._log("Training stopped by user", level="WARN")
                break

            self._log(f"Epoch {epoch}/{cfg.epochs} complete — loss: {self.metrics.train_loss:.4f}")

        # Final save
        if not self._stop_event.is_set():
            save_checkpoint(model, optimizer, global_step, cfg.epochs,
                            self.metrics.train_loss, self.metrics.val_loss,
                            cfg.model_name, False)
            self.metrics.status = "completed"
            self._log("Training complete! Model saved.", level="INFO")
        else:
            self.metrics.status = "stopped"
            save_checkpoint(model, optimizer, global_step, epoch,
                            self.metrics.train_loss, self.metrics.val_loss,
                            cfg.model_name, False)
            self._log("Training stopped. Checkpoint saved.", level="WARN")

        self._emit()

    def _validate(self, model, val_loader, device, use_amp, amp_dtype) -> float:
        model.eval()
        total_loss = 0.0
        count = 0
        max_batches = 50  # cap validation for speed
        with torch.no_grad():
            for x, y in val_loader:
                if count >= max_batches:
                    break
                x, y = x.to(device), y.to(device)
                if use_amp:
                    with torch.amp.autocast(device.type, dtype=amp_dtype):
                        _, loss = model(x, y)
                else:
                    _, loss = model(x, y)
                total_loss += loss.item()
                count += 1
        return total_loss / max(count, 1)

    def _build_optimizer(self, model):
        cfg = self.config
        # Separate weight decay params
        decay = {n for n, p in model.named_parameters() if p.dim() >= 2}
        no_decay = {n for n, p in model.named_parameters() if p.dim() < 2}
        param_groups = [
            {"params": [p for n, p in model.named_parameters() if n in decay], "weight_decay": cfg.weight_decay},
            {"params": [p for n, p in model.named_parameters() if n in no_decay], "weight_decay": 0.0},
        ]
        if cfg.optimizer == "adamw":
            return torch.optim.AdamW(param_groups, lr=cfg.learning_rate, betas=(0.9, 0.95))
        elif cfg.optimizer == "adam":
            return torch.optim.Adam(param_groups, lr=cfg.learning_rate)
        else:
            return torch.optim.SGD(param_groups, lr=cfg.learning_rate, momentum=0.9)

    def _build_scheduler(self, optimizer, total_steps: int):
        cfg = self.config
        warmup = min(cfg.warmup_steps, total_steps // 10)
        if cfg.scheduler == "cosine":
            def lr_lambda(step):
                if step < warmup:
                    return step / max(warmup, 1)
                progress = (step - warmup) / max(total_steps - warmup, 1)
                return max(0.1, 0.5 * (1.0 + math.cos(math.pi * progress)))
            return torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
        elif cfg.scheduler == "linear":
            return torch.optim.lr_scheduler.LinearLR(optimizer, start_factor=1.0, end_factor=0.1, total_iters=total_steps)
        else:
            return torch.optim.lr_scheduler.ConstantLR(optimizer, factor=1.0)

    def _get_device(self) -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def _update_system_stats(self):
        try:
            import psutil
            self.metrics.cpu_percent = psutil.cpu_percent()
            self.metrics.ram_percent = psutil.virtual_memory().percent
        except Exception:
            pass
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                g = gpus[0]
                self.metrics.gpu_temp = g.temperature
                self.metrics.gpu_utilization = round(g.load * 100, 1)
                self.metrics.vram_used_gb = round(g.memoryUsed / 1024, 2)
        except Exception:
            pass

    def _log(self, message: str, level: str = "INFO"):
        import datetime
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {level:<6} {message}"
        logger.info(line)
        self.metrics.log_lines.append(line)
        # Keep last 200 log lines
        if len(self.metrics.log_lines) > 200:
            self.metrics.log_lines = self.metrics.log_lines[-200:]
        self._emit()

    def _emit(self):
        if self.on_metrics:
            self.on_metrics(asdict(self.metrics))
