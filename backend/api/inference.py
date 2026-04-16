"""Inference API — REST endpoints and WebSocket for streaming generation."""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from engine.inference import generate_tokens, load_model, unload_model, list_available_models

logger = logging.getLogger(__name__)
inference_router = APIRouter()


class GenerateRequest(BaseModel):
    model_name: str
    prompt: str
    max_new_tokens: int = 256
    temperature: float = 0.7
    top_k: int = 50
    top_p: float = 0.9
    repetition_penalty: float = 1.1


@inference_router.get("/models")
async def get_available_models():
    """List all models available for inference."""
    return {"models": list_available_models()}


@inference_router.post("/load/{model_name}")
async def load_model_endpoint(model_name: str):
    """Pre-load a model into memory."""
    try:
        _, _, cfg = load_model(model_name)
        return {"message": f"Model '{model_name}' loaded", "config": cfg}
    except FileNotFoundError as e:
        return {"error": str(e)}


@inference_router.post("/unload/{model_name}")
async def unload_model_endpoint(model_name: str):
    """Unload a model from memory."""
    unload_model(model_name)
    return {"message": f"Model '{model_name}' unloaded"}


@inference_router.post("/generate")
async def generate_endpoint(request: GenerateRequest):
    """Non-streaming generation — returns full response."""
    try:
        tokens = []
        last = {}
        for chunk in generate_tokens(
            model_name=request.model_name,
            prompt=request.prompt,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty,
        ):
            tokens.append(chunk["token"])
            last = chunk
        return {
            "text": "".join(tokens),
            "total_tokens": last.get("total_tokens", len(tokens)),
            "tokens_per_second": last.get("tokens_per_second", 0),
            "latency_ms": last.get("latency_ms", 0),
            "perplexity": last.get("perplexity"),
            "elapsed_ms": last.get("elapsed_ms"),
        }
    except Exception as e:
        logger.exception("Generation failed")
        return {"error": str(e)}


@inference_router.websocket("/ws/generate")
async def generate_websocket(websocket: WebSocket):
    """
    Streaming generation via WebSocket.

    Client sends JSON: { model_name, prompt, max_new_tokens, temperature, top_k, top_p, repetition_penalty }
    Server streams JSON chunks: { token, step, done, tokens_per_second, latency_ms?, total_tokens?, perplexity? }
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                req = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            model_name = req.get("model_name", "")
            prompt = req.get("prompt", "")
            if not model_name or not prompt:
                await websocket.send_json({"error": "model_name and prompt are required"})
                continue

            try:
                import asyncio
                loop = asyncio.get_event_loop()

                def _gen():
                    return list(generate_tokens(
                        model_name=model_name,
                        prompt=prompt,
                        max_new_tokens=req.get("max_new_tokens", 256),
                        temperature=req.get("temperature", 0.7),
                        top_k=req.get("top_k", 50),
                        top_p=req.get("top_p", 0.9),
                        repetition_penalty=req.get("repetition_penalty", 1.1),
                    ))

                # Run generation in thread pool to avoid blocking the event loop
                chunks = await loop.run_in_executor(None, _gen)
                for chunk in chunks:
                    await websocket.send_json(chunk)

            except Exception as e:
                logger.exception("Streaming generation failed")
                await websocket.send_json({"error": str(e), "done": True})

    except WebSocketDisconnect:
        logger.info("Inference WebSocket disconnected")
