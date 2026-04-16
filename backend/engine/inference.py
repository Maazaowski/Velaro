"""Inference engine — model loading, caching, and streaming text generation."""

import logging
import math
import time
from pathlib import Path
from typing import Iterator, AsyncIterator

import torch

from engine.model import VelaroGPT, ModelConfig
from engine.checkpoint import load_checkpoint, CHECKPOINTS_DIR

logger = logging.getLogger(__name__)

# In-memory model cache: model_name -> (model, tokenizer, config)
_model_cache: dict[str, tuple] = {}


def _get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def load_model(model_name: str, checkpoint: str = "best") -> tuple:
    """Load a model into cache and return (model, tokenizer, config_dict)."""
    if model_name in _model_cache:
        logger.info(f"Model '{model_name}' already cached")
        return _model_cache[model_name]

    state = load_checkpoint(model_name, checkpoint)
    if state is None:
        raise FileNotFoundError(f"No checkpoint found for model '{model_name}'")

    model_cfg_dict = state.get("model_config", {})
    cfg = ModelConfig(
        vocab_size=model_cfg_dict.get("vocab_size", 50257),
        context_length=model_cfg_dict.get("context_length", 1024),
        hidden_size=model_cfg_dict.get("hidden_size", 768),
        num_layers=model_cfg_dict.get("num_layers", 12),
        num_attention_heads=model_cfg_dict.get("num_attention_heads", 12),
        intermediate_size=model_cfg_dict.get("intermediate_size", 3072),
    )

    device = _get_device()
    model = VelaroGPT(cfg).to(device)
    model.load_state_dict(state["model_state_dict"])
    model.eval()

    # Load tokenizer
    tokenizer = _load_tokenizer()

    logger.info(f"Loaded model '{model_name}' ({model.count_parameters()/1e6:.1f}M params) on {device}")
    _model_cache[model_name] = (model, tokenizer, model_cfg_dict)
    return model, tokenizer, model_cfg_dict


def unload_model(model_name: str):
    """Remove a model from cache to free memory."""
    if model_name in _model_cache:
        del _model_cache[model_name]
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info(f"Unloaded model '{model_name}'")


def _load_tokenizer():
    try:
        import tiktoken
        return tiktoken.get_encoding("gpt2")
    except ImportError:
        return None


def _encode(text: str, tokenizer) -> list[int]:
    if tokenizer is None:
        return [ord(c) % 256 for c in text]
    return tokenizer.encode(text)


def _decode(tokens: list[int], tokenizer) -> str:
    if tokenizer is None:
        return "".join(chr(t) for t in tokens)
    return tokenizer.decode(tokens)


def _sample_token(logits: torch.Tensor, temperature: float, top_k: int, top_p: float) -> int:
    """Sample next token from logits with temperature, top-k, and top-p."""
    logits = logits.squeeze()  # (vocab_size,)

    if temperature == 0:
        return logits.argmax().item()

    logits = logits / temperature

    # Top-K
    if top_k > 0:
        top_k = min(top_k, logits.size(-1))
        kth_val = torch.topk(logits, top_k)[0][-1]
        logits[logits < kth_val] = float("-inf")

    # Top-P (nucleus)
    if top_p < 1.0:
        sorted_logits, sorted_idx = torch.sort(logits, descending=True)
        cumulative = torch.cumsum(torch.softmax(sorted_logits, dim=-1), dim=-1)
        remove = cumulative - torch.softmax(sorted_logits, dim=-1) > top_p
        sorted_logits[remove] = float("-inf")
        logits = torch.zeros_like(logits).scatter_(0, sorted_idx, sorted_logits)

    probs = torch.softmax(logits, dim=-1)
    return torch.multinomial(probs, num_samples=1).item()


def generate_tokens(
    model_name: str,
    prompt: str,
    max_new_tokens: int = 256,
    temperature: float = 0.7,
    top_k: int = 50,
    top_p: float = 0.9,
    repetition_penalty: float = 1.1,
) -> Iterator[dict]:
    """
    Generate tokens one at a time. Yields dicts with:
      - token: str (decoded token)
      - token_id: int
      - step: int
      - done: bool
      - latency_ms: float (time-to-first-token on step 0)
      - tokens_per_second: float
      - total_tokens: int (on done=True)
      - perplexity: float (on done=True)
    """
    model, tokenizer, cfg = load_model(model_name)
    device = next(model.parameters()).device
    ctx_len = cfg.get("context_length", 1024)

    input_ids = _encode(prompt, tokenizer)
    idx = torch.tensor([input_ids], dtype=torch.long, device=device)

    start_time = time.time()
    ttft: float | None = None
    log_probs_sum = 0.0
    generated = []

    with torch.no_grad():
        for step in range(max_new_tokens):
            # Crop to context window
            idx_crop = idx[:, -ctx_len:]

            logits, _ = model(idx_crop)
            logits = logits[:, -1, :]  # (1, vocab_size)

            # Repetition penalty
            if repetition_penalty != 1.0 and len(generated) > 0:
                for prev_id in set(generated[-64:]):
                    logits[0, prev_id] /= repetition_penalty

            # Track log prob for perplexity
            log_prob = torch.log_softmax(logits[0], dim=-1)

            next_id = _sample_token(logits[0], temperature, top_k, top_p)
            generated.append(next_id)

            log_probs_sum += log_prob[next_id].item()

            # Decode token
            try:
                tok_str = _decode([next_id], tokenizer)
            except Exception:
                tok_str = "?"

            elapsed = time.time() - start_time
            if ttft is None:
                ttft = elapsed * 1000

            tok_per_sec = len(generated) / max(elapsed, 1e-6)

            idx = torch.cat([idx, torch.tensor([[next_id]], device=device)], dim=1)

            # EOS check (token 50256 in GPT-2 vocab)
            is_eos = (next_id == 50256)
            is_done = is_eos or step == max_new_tokens - 1

            payload = {
                "token": tok_str,
                "token_id": next_id,
                "step": step,
                "done": is_done,
                "tokens_per_second": round(tok_per_sec, 1),
                "latency_ms": round(ttft, 1) if step == 0 else None,
            }

            if is_done:
                perplexity = math.exp(-log_probs_sum / max(len(generated), 1))
                payload["total_tokens"] = len(generated)
                payload["perplexity"] = round(perplexity, 2)
                payload["elapsed_ms"] = round(elapsed * 1000, 1)

            yield payload

            if is_done:
                break


def list_available_models() -> list[dict]:
    """List all models with saved checkpoints."""
    models = []
    if CHECKPOINTS_DIR.exists():
        for model_dir in CHECKPOINTS_DIR.iterdir():
            if model_dir.is_dir():
                has_best = (model_dir / "best.pt").exists()
                checkpoints = sorted(model_dir.glob("step-*.pt"))
                if has_best or checkpoints:
                    state = None
                    try:
                        import torch
                        ckpt_path = model_dir / "best.pt" if has_best else checkpoints[-1]
                        state = torch.load(ckpt_path, map_location="cpu", weights_only=True)
                    except Exception:
                        pass
                    models.append({
                        "name": model_dir.name,
                        "status": "ready",
                        "has_best": has_best,
                        "num_checkpoints": len(checkpoints),
                        "train_loss": state.get("train_loss") if state else None,
                        "val_loss": state.get("val_loss") if state else None,
                        "step": state.get("step") if state else None,
                        "loaded": model_dir.name in _model_cache,
                    })
    return models
