"""Dataset loading and tokenization pipeline."""

import os
import json
import logging
from pathlib import Path
from typing import Iterator

import torch
from torch.utils.data import Dataset, DataLoader

logger = logging.getLogger(__name__)


class TextDataset(Dataset):
    """Simple character/token-level dataset from a text file or string."""

    def __init__(self, tokens: list[int], context_length: int):
        self.tokens = torch.tensor(tokens, dtype=torch.long)
        self.context_length = context_length

    def __len__(self) -> int:
        return max(0, len(self.tokens) - self.context_length)

    def __getitem__(self, idx: int):
        chunk = self.tokens[idx : idx + self.context_length + 1]
        x = chunk[:-1]
        y = chunk[1:]
        return x, y


def load_tokenizer(tokenizer_type: str = "bpe"):
    """Load tokenizer. Falls back to tiktoken GPT-2 BPE."""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("gpt2")
        return enc
    except ImportError:
        logger.warning("tiktoken not installed, using basic char tokenizer")
        return None


def tokenize_text(text: str, tokenizer) -> list[int]:
    """Tokenize text using the given tokenizer."""
    if tokenizer is None:
        # Basic char-level fallback
        chars = sorted(set(text))
        char_to_idx = {c: i for i, c in enumerate(chars)}
        return [char_to_idx[c] for c in text]
    return tokenizer.encode(text)


def load_dataset_from_source(
    source: str,
    path_or_id: str,
    context_length: int,
    tokenizer_type: str = "bpe",
    val_split: float = 0.1,
) -> tuple[TextDataset, TextDataset]:
    """
    Load training and validation datasets from a source.

    Args:
        source: 'local', 'huggingface', or 'paste'
        path_or_id: file path, HF dataset ID, or raw text
        context_length: token window size
        tokenizer_type: 'bpe', 'sentencepiece', or 'custom'
        val_split: fraction of data to use for validation

    Returns:
        (train_dataset, val_dataset)
    """
    tokenizer = load_tokenizer(tokenizer_type)

    if source == "paste":
        text = path_or_id
        logger.info(f"Using pasted text ({len(text)} chars)")

    elif source == "local":
        p = Path(path_or_id)
        if p.is_dir():
            texts = []
            for f in p.glob("**/*.txt"):
                texts.append(f.read_text(encoding="utf-8", errors="ignore"))
            text = "\n\n".join(texts)
        else:
            text = p.read_text(encoding="utf-8", errors="ignore")
        logger.info(f"Loaded local dataset: {len(text)} chars")

    elif source == "huggingface":
        try:
            from datasets import load_dataset as hf_load
            ds = hf_load(path_or_id, trust_remote_code=True)
            split = ds["train"] if "train" in ds else list(ds.values())[0]
            # Try common text column names
            text_col = next((c for c in ["text", "content", "story"] if c in split.column_names), split.column_names[0])
            text = "\n\n".join(split[text_col][:10000])  # cap at 10k samples for now
            logger.info(f"Loaded HuggingFace dataset '{path_or_id}': {len(text)} chars")
        except Exception as e:
            raise RuntimeError(f"Failed to load HuggingFace dataset '{path_or_id}': {e}")
    else:
        raise ValueError(f"Unknown dataset source: {source}")

    # Tokenize
    logger.info("Tokenizing dataset...")
    tokens = tokenize_text(text, tokenizer)
    logger.info(f"Total tokens: {len(tokens):,}")

    # Split
    split_idx = int(len(tokens) * (1 - val_split))
    train_tokens = tokens[:split_idx]
    val_tokens = tokens[split_idx:]

    train_ds = TextDataset(train_tokens, context_length)
    val_ds = TextDataset(val_tokens, context_length)

    logger.info(f"Train samples: {len(train_ds):,} | Val samples: {len(val_ds):,}")
    return train_ds, val_ds


def create_dataloader(dataset: TextDataset, batch_size: int, shuffle: bool = True) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
        drop_last=True,
    )
