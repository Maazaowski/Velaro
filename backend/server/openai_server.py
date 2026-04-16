"""
OpenAI-compatible local API server.

Implements a subset of the OpenAI Chat Completions API so users can use
any OpenAI-compatible client with their locally trained models.

Endpoints:
  GET  /v1/models
  POST /v1/completions
  POST /v1/chat/completions
"""

import time
import uuid
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="Velaro OpenAI-Compatible Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: list[Message]
    max_tokens: int = 256
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50
    repetition_penalty: float = 1.1
    stream: bool = False

class CompletionRequest(BaseModel):
    model: str
    prompt: str
    max_tokens: int = 256
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50
    repetition_penalty: float = 1.1
    stream: bool = False


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/v1/models")
async def list_models():
    """List available models — OpenAI compatible."""
    from engine.inference import list_available_models
    models = list_available_models()
    return {
        "object": "list",
        "data": [
            {
                "id": m["name"],
                "object": "model",
                "created": int(time.time()),
                "owned_by": "velaro",
            }
            for m in models
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "server": "velaro-openai-compat"}


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    """OpenAI-compatible chat completions endpoint."""
    from engine.inference import generate_tokens

    # Convert messages to a prompt
    prompt = _messages_to_prompt(request.messages)

    tokens = []
    last = {}
    try:
        for chunk in generate_tokens(
            model_name=request.model,
            prompt=prompt,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty,
        ):
            tokens.append(chunk.get("token", ""))
            last = chunk
    except Exception as e:
        return {"error": {"message": str(e), "type": "server_error"}}

    content = "".join(tokens)
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": len(prompt.split()),
            "completion_tokens": last.get("total_tokens", len(tokens)),
            "total_tokens": len(prompt.split()) + last.get("total_tokens", len(tokens)),
        },
    }


@app.post("/v1/completions")
async def completions(request: CompletionRequest):
    """OpenAI-compatible completions endpoint."""
    from engine.inference import generate_tokens

    tokens = []
    last = {}
    try:
        for chunk in generate_tokens(
            model_name=request.model,
            prompt=request.prompt,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty,
        ):
            tokens.append(chunk.get("token", ""))
            last = chunk
    except Exception as e:
        return {"error": {"message": str(e), "type": "server_error"}}

    text = "".join(tokens)
    return {
        "id": f"cmpl-{uuid.uuid4().hex[:12]}",
        "object": "text_completion",
        "created": int(time.time()),
        "model": request.model,
        "choices": [{"text": text, "index": 0, "finish_reason": "stop"}],
        "usage": {
            "prompt_tokens": len(request.prompt.split()),
            "completion_tokens": last.get("total_tokens", len(tokens)),
            "total_tokens": len(request.prompt.split()) + last.get("total_tokens", len(tokens)),
        },
    }


def _messages_to_prompt(messages: list[Message]) -> str:
    """Convert chat messages to a single prompt string."""
    parts = []
    for m in messages:
        if m.role == "system":
            parts.append(f"System: {m.content}")
        elif m.role == "user":
            parts.append(f"User: {m.content}")
        elif m.role == "assistant":
            parts.append(f"Assistant: {m.content}")
    parts.append("Assistant:")
    return "\n".join(parts)


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)
