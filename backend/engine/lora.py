"""LoRA (Low-Rank Adaptation) for efficient fine-tuning of VelaroGPT models."""

import math
from typing import Optional

import torch
import torch.nn as nn


class LoRALinear(nn.Module):
    """Drop-in replacement for nn.Linear with LoRA adapter matrices."""

    def __init__(
        self,
        linear: nn.Linear,
        rank: int = 8,
        alpha: float = 16.0,
        dropout: float = 0.05,
    ) -> None:
        super().__init__()
        self.in_features = linear.in_features
        self.out_features = linear.out_features
        self.rank = rank
        self.alpha = alpha
        self.scale = alpha / rank

        # Freeze base weights
        self.weight = linear.weight
        self.weight.requires_grad_(False)
        self.bias = linear.bias
        if self.bias is not None:
            self.bias.requires_grad_(False)

        # LoRA trainable matrices
        self.lora_A = nn.Parameter(torch.empty(rank, self.in_features))
        self.lora_B = nn.Parameter(torch.zeros(self.out_features, rank))
        self.dropout = nn.Dropout(p=dropout)

        # Kaiming init for A, zeros for B → starts as identity delta
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        base = nn.functional.linear(x, self.weight, self.bias)
        lora_delta = self.dropout(x) @ self.lora_A.T @ self.lora_B.T
        return base + lora_delta * self.scale

    def merge_weights(self) -> nn.Linear:
        """Return a plain nn.Linear with LoRA merged in (for export / inference)."""
        merged = nn.Linear(
            self.in_features, self.out_features,
            bias=self.bias is not None,
            device=self.weight.device,
            dtype=self.weight.dtype,
        )
        with torch.no_grad():
            merged.weight.copy_(self.weight + (self.lora_B @ self.lora_A) * self.scale)
            if self.bias is not None:
                merged.bias.copy_(self.bias)
        return merged


def inject_lora(
    model: nn.Module,
    rank: int = 8,
    alpha: float = 16.0,
    dropout: float = 0.05,
    target_modules: Optional[list[str]] = None,
) -> nn.Module:
    """
    Replace nn.Linear layers whose name ends with a target suffix
    with LoRALinear adapters.

    Default targets: attention projection layers common in GPT models.
    """
    if target_modules is None:
        target_modules = ["c_attn", "c_proj", "q_proj", "v_proj"]

    modules_map = dict(model.named_modules())

    for name, module in list(modules_map.items()):
        if not isinstance(module, nn.Linear):
            continue
        local_name = name.split(".")[-1]
        if local_name not in target_modules:
            continue
        # Navigate to the parent module and replace the child
        if "." in name:
            parent_name, child_name = name.rsplit(".", 1)
            parent = modules_map[parent_name]
        else:
            parent = model
            child_name = name
        setattr(parent, child_name, LoRALinear(module, rank=rank, alpha=alpha, dropout=dropout))

    return model


def get_lora_params(model: nn.Module) -> list[nn.Parameter]:
    """Return all LoRA trainable parameters (lora_A / lora_B)."""
    return [p for n, p in model.named_parameters() if "lora_" in n and p.requires_grad]


def lora_param_count(model: nn.Module) -> int:
    """Count the number of trainable LoRA parameters."""
    return sum(p.numel() for p in get_lora_params(model))


def freeze_base_weights(model: nn.Module) -> None:
    """Freeze all parameters that are NOT LoRA adapters."""
    for name, param in model.named_parameters():
        if "lora_" not in name:
            param.requires_grad_(False)


def merge_lora_weights(model: nn.Module) -> nn.Module:
    """Merge all LoRALinear adapters into base weights (for inference / export)."""
    modules_map = dict(model.named_modules())
    for name, module in list(modules_map.items()):
        if not isinstance(module, LoRALinear):
            continue
        if "." in name:
            parent_name, child_name = name.rsplit(".", 1)
            parent = modules_map[parent_name]
        else:
            parent = model
            child_name = name
        setattr(parent, child_name, module.merge_weights())
    return model
