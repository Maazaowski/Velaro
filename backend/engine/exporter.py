"""Model export utilities — SafeTensors, ONNX, quantization, model card."""

import json
import logging
import shutil
import time
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

EXPORTS_DIR = Path("./exports")


def export_safetensors(model_name: str, on_progress: Callable[[str], None] | None = None) -> Path:
    """Export model weights as SafeTensors format."""
    from engine.checkpoint import load_checkpoint
    from engine.model import VelaroGPT, ModelConfig
    import torch

    on_progress and on_progress("Loading checkpoint...")
    state = load_checkpoint(model_name, "best") or load_checkpoint(model_name, "latest")
    if not state:
        raise FileNotFoundError(f"No checkpoint for '{model_name}'")

    cfg_dict = state.get("model_config", {})
    cfg = ModelConfig(**{k: v for k, v in cfg_dict.items() if hasattr(ModelConfig, k)})
    model = VelaroGPT(cfg)
    model.load_state_dict(state["model_state_dict"])
    model.eval()

    out_dir = EXPORTS_DIR / model_name / "safetensors"
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        from safetensors.torch import save_file
        on_progress and on_progress("Saving SafeTensors weights...")
        tensors = {k: v.contiguous() for k, v in model.state_dict().items()}
        out_path = out_dir / "model.safetensors"
        save_file(tensors, str(out_path))
    except ImportError:
        on_progress and on_progress("safetensors not installed — saving as PyTorch .pt instead...")
        out_path = out_dir / "model.pt"
        torch.save(model.state_dict(), out_path)

    # Save config
    with open(out_dir / "config.json", "w") as f:
        json.dump(cfg_dict, f, indent=2)

    size_mb = out_path.stat().st_size / (1024 ** 2)
    on_progress and on_progress(f"Exported to {out_path} ({size_mb:.1f} MB)")
    return out_path


def export_onnx(model_name: str, on_progress: Callable[[str], None] | None = None) -> Path:
    """Export model to ONNX format for cross-platform inference."""
    import torch
    from engine.checkpoint import load_checkpoint
    from engine.model import VelaroGPT, ModelConfig

    on_progress and on_progress("Loading checkpoint...")
    state = load_checkpoint(model_name, "best") or load_checkpoint(model_name, "latest")
    if not state:
        raise FileNotFoundError(f"No checkpoint for '{model_name}'")

    cfg_dict = state.get("model_config", {})
    cfg = ModelConfig(**{k: v for k, v in cfg_dict.items() if hasattr(ModelConfig, k)})
    model = VelaroGPT(cfg)
    model.load_state_dict(state["model_state_dict"])
    model.eval()

    out_dir = EXPORTS_DIR / model_name / "onnx"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "model.onnx"

    on_progress and on_progress("Tracing model for ONNX export...")
    dummy_input = torch.zeros(1, min(32, cfg.context_length), dtype=torch.long)

    try:
        torch.onnx.export(
            model,
            (dummy_input,),
            str(out_path),
            input_names=["input_ids"],
            output_names=["logits"],
            dynamic_axes={"input_ids": {0: "batch", 1: "seq_len"}, "logits": {0: "batch", 1: "seq_len"}},
            opset_version=17,
        )
        size_mb = out_path.stat().st_size / (1024 ** 2)
        on_progress and on_progress(f"ONNX export complete: {out_path} ({size_mb:.1f} MB)")
    except Exception as e:
        on_progress and on_progress(f"ONNX export failed: {e}")
        raise

    return out_path


def quantize_model(
    model_name: str,
    quantization: str = "int8",
    on_progress: Callable[[str], None] | None = None,
) -> Path:
    """Quantize model weights for reduced size and faster inference."""
    import torch
    from engine.checkpoint import load_checkpoint
    from engine.model import VelaroGPT, ModelConfig

    on_progress and on_progress(f"Loading model for {quantization.upper()} quantization...")
    state = load_checkpoint(model_name, "best") or load_checkpoint(model_name, "latest")
    if not state:
        raise FileNotFoundError(f"No checkpoint for '{model_name}'")

    cfg_dict = state.get("model_config", {})
    cfg = ModelConfig(**{k: v for k, v in cfg_dict.items() if hasattr(ModelConfig, k)})
    model = VelaroGPT(cfg)
    model.load_state_dict(state["model_state_dict"])
    model.eval()

    out_dir = EXPORTS_DIR / model_name / f"quantized_{quantization}"
    out_dir.mkdir(parents=True, exist_ok=True)

    if quantization == "int8":
        on_progress and on_progress("Applying dynamic INT8 quantization...")
        quantized = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear}, dtype=torch.qint8
        )
        out_path = out_dir / "model_int8.pt"
        torch.save(quantized.state_dict(), out_path)

    elif quantization == "fp16":
        on_progress and on_progress("Converting to FP16...")
        model_fp16 = model.half()
        out_path = out_dir / "model_fp16.pt"
        torch.save(model_fp16.state_dict(), out_path)

    else:
        raise ValueError(f"Unsupported quantization: {quantization}")

    size_mb = out_path.stat().st_size / (1024 ** 2)
    on_progress and on_progress(f"{quantization.upper()} quantization done: {out_path} ({size_mb:.1f} MB)")
    return out_path


def generate_model_card(model_name: str, extra_info: dict | None = None) -> str:
    """Generate a markdown model card for the trained model."""
    from engine.checkpoint import load_checkpoint, list_checkpoints

    state = load_checkpoint(model_name, "best") or load_checkpoint(model_name, "latest")
    cfg = state.get("model_config", {}) if state else {}
    checkpoints = list_checkpoints(model_name)

    train_loss = state.get("train_loss", "N/A") if state else "N/A"
    val_loss = state.get("val_loss", "N/A") if state else "N/A"
    step = state.get("step", "N/A") if state else "N/A"

    card = f"""# {model_name}

> Built with [Velaro](https://github.com/velaro) — No-code LLM builder

## Model Details

| Property | Value |
|----------|-------|
| Architecture | {cfg.get('architecture', 'Transformer (Decoder-only)')} |
| Parameters | ~{_fmt_params(cfg)} |
| Hidden Size | {cfg.get('hidden_size', 'N/A')} |
| Layers | {cfg.get('num_layers', 'N/A')} |
| Attention Heads | {cfg.get('num_attention_heads', 'N/A')} |
| Context Length | {cfg.get('context_length', 'N/A')} |
| Vocabulary Size | {cfg.get('vocab_size', 'N/A')} |

## Training Results

| Metric | Value |
|--------|-------|
| Final Train Loss | {train_loss if isinstance(train_loss, str) else f'{train_loss:.4f}'} |
| Best Val Loss | {val_loss if isinstance(val_loss, str) else f'{val_loss:.4f}'} |
| Training Steps | {step:,} if isinstance(step, int) else step |
| Checkpoints | {len(checkpoints)} |

## Usage

### Local API (OpenAI-compatible)

```bash
# Start the Velaro server
python -m server.openai_server --model {model_name} --port 8080

# Use with any OpenAI-compatible client
curl http://localhost:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model": "{model_name}",
    "messages": [{{"role": "user", "content": "Hello!"}}]
  }}'
```

### Python

```python
from velaro import load_model, generate

model = load_model("{model_name}")
output = generate(model, "Once upon a time", max_tokens=100)
print(output)
```

## License

This model was trained locally using Velaro. Use at your own discretion.

---
*Generated by Velaro on {_now()}*
"""

    # Save model card
    out_dir = EXPORTS_DIR / model_name
    out_dir.mkdir(parents=True, exist_ok=True)
    card_path = out_dir / "MODEL_CARD.md"
    card_path.write_text(card, encoding="utf-8")
    return card


def generate_dockerfile(model_name: str) -> tuple[str, str]:
    """Generate Dockerfile and docker-compose.yml for the model."""
    dockerfile = f"""FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN pip install fastapi uvicorn torch --index-url https://download.pytorch.org/whl/cpu tiktoken safetensors

# Copy model files
COPY exports/{model_name}/ ./model/
COPY backend/ ./backend/

WORKDIR /app/backend
ENV MODEL_NAME={model_name}
ENV MODEL_PATH=/app/model

EXPOSE 8080

CMD ["uvicorn", "server.openai_server:app", "--host", "0.0.0.0", "--port", "8080"]
"""

    compose = f"""version: "3.9"

services:
  {model_name.lower().replace("-", "_")}:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MODEL_NAME={model_name}
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
"""

    out_dir = EXPORTS_DIR / model_name
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "Dockerfile").write_text(dockerfile, encoding="utf-8")
    (out_dir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    return dockerfile, compose


def get_export_files(model_name: str) -> list[dict]:
    """List all exported files for a model."""
    out_dir = EXPORTS_DIR / model_name
    if not out_dir.exists():
        return []
    files = []
    for p in sorted(out_dir.rglob("*")):
        if p.is_file():
            files.append({
                "name": p.name,
                "path": str(p.relative_to(EXPORTS_DIR)),
                "size_mb": round(p.stat().st_size / (1024 ** 2), 2),
                "type": _file_type(p.suffix),
            })
    return files


def _fmt_params(cfg: dict) -> str:
    h = cfg.get("hidden_size", 768)
    l = cfg.get("num_layers", 12)
    v = cfg.get("vocab_size", 50257)
    i = cfg.get("intermediate_size", 3072)
    approx = (v * h + l * (4 * h * h + 2 * h * i)) / 1e6
    return f"{approx:.0f}M"


def _file_type(suffix: str) -> str:
    return {".safetensors": "SafeTensors", ".pt": "PyTorch", ".onnx": "ONNX",
            ".md": "Model Card", ".yml": "Docker Compose", "": "Dockerfile"}.get(suffix, "File")


def _now() -> str:
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d")
