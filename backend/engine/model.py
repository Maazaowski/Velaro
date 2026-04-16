"""GPT-style decoder-only Transformer model."""

import math
import torch
import torch.nn as nn
from dataclasses import dataclass


@dataclass
class ModelConfig:
    vocab_size: int = 50257
    context_length: int = 1024
    hidden_size: int = 768
    num_layers: int = 12
    num_attention_heads: int = 12
    intermediate_size: int = 3072
    dropout: float = 0.1
    bias: bool = True


class CausalSelfAttention(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        assert config.hidden_size % config.num_attention_heads == 0
        self.num_heads = config.num_attention_heads
        self.head_dim = config.hidden_size // config.num_attention_heads
        self.hidden_size = config.hidden_size

        self.c_attn = nn.Linear(config.hidden_size, 3 * config.hidden_size, bias=config.bias)
        self.c_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=config.bias)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)

        self.register_buffer(
            "bias",
            torch.tril(torch.ones(config.context_length, config.context_length))
            .view(1, 1, config.context_length, config.context_length),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()
        q, k, v = self.c_attn(x).split(self.hidden_size, dim=2)
        q = q.view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.num_heads, self.head_dim).transpose(1, 2)

        scale = 1.0 / math.sqrt(self.head_dim)
        att = (q @ k.transpose(-2, -1)) * scale
        att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float("-inf"))
        att = torch.softmax(att, dim=-1)
        att = self.attn_dropout(att)

        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.resid_dropout(self.c_proj(y))


class MLP(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.c_fc = nn.Linear(config.hidden_size, config.intermediate_size, bias=config.bias)
        self.gelu = nn.GELU()
        self.c_proj = nn.Linear(config.intermediate_size, config.hidden_size, bias=config.bias)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.c_proj(self.gelu(self.c_fc(x))))


class TransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.ln_1 = nn.LayerNorm(config.hidden_size, bias=config.bias)
        self.attn = CausalSelfAttention(config)
        self.ln_2 = nn.LayerNorm(config.hidden_size, bias=config.bias)
        self.mlp = MLP(config)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln_1(x))
        x = x + self.mlp(self.ln_2(x))
        return x


class VelaroGPT(nn.Module):
    """GPT-style decoder-only transformer."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config
        self.transformer = nn.ModuleDict({
            "wte": nn.Embedding(config.vocab_size, config.hidden_size),
            "wpe": nn.Embedding(config.context_length, config.hidden_size),
            "drop": nn.Dropout(config.dropout),
            "h": nn.ModuleList([TransformerBlock(config) for _ in range(config.num_layers)]),
            "ln_f": nn.LayerNorm(config.hidden_size, bias=config.bias),
        })
        self.lm_head = nn.Linear(config.hidden_size, config.vocab_size, bias=False)
        # Weight tying
        self.transformer["wte"].weight = self.lm_head.weight

        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor, targets: torch.Tensor | None = None):
        B, T = idx.size()
        assert T <= self.config.context_length

        pos = torch.arange(0, T, dtype=torch.long, device=idx.device)
        tok_emb = self.transformer["wte"](idx)
        pos_emb = self.transformer["wpe"](pos)
        x = self.transformer["drop"](tok_emb + pos_emb)

        for block in self.transformer["h"]:
            x = block(x)

        x = self.transformer["ln_f"](x)

        if targets is not None:
            logits = self.lm_head(x)
            loss = torch.nn.functional.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1
            )
            return logits, loss

        logits = self.lm_head(x[:, [-1], :])
        return logits, None

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())

    @classmethod
    def from_config_dict(cls, cfg: dict) -> "VelaroGPT":
        model_cfg = ModelConfig(
            vocab_size=cfg.get("vocab_size", 50257),
            context_length=cfg.get("context_length", 1024),
            hidden_size=cfg.get("hidden_size", 768),
            num_layers=cfg.get("num_layers", 12),
            num_attention_heads=cfg.get("num_attention_heads", 12),
            intermediate_size=cfg.get("intermediate_size", 3072),
        )
        return cls(model_cfg)
