"""Publish API — model export, local server control, Docker, model cards."""

import asyncio
import logging
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

logger = logging.getLogger(__name__)
publish_router = APIRouter()

# Track running local API server process
_server_process: subprocess.Popen | None = None
_server_config: dict = {}
_export_progress: dict[str, list[str]] = {}


class ExportRequest(BaseModel):
    model_name: str
    format: str  # "safetensors" | "onnx" | "int8" | "fp16"


class ServerConfig(BaseModel):
    model_name: str
    host: str = "0.0.0.0"
    port: int = 8080
    max_concurrency: int = 4


# ── Export ───────────────────────────────────────────────────────────────────

@publish_router.post("/export")
async def export_model(request: ExportRequest):
    """Export model in the requested format (runs in background thread)."""
    from engine.exporter import export_safetensors, export_onnx, quantize_model

    logs: list[str] = []
    _export_progress[request.model_name] = logs

    def on_progress(msg: str):
        logs.append(msg)

    loop = asyncio.get_event_loop()

    try:
        if request.format == "safetensors":
            path = await loop.run_in_executor(None, lambda: export_safetensors(request.model_name, on_progress))
        elif request.format == "onnx":
            path = await loop.run_in_executor(None, lambda: export_onnx(request.model_name, on_progress))
        elif request.format in ("int8", "fp16"):
            path = await loop.run_in_executor(None, lambda: quantize_model(request.model_name, request.format, on_progress))
        else:
            return {"error": f"Unknown format: {request.format}"}

        return {"success": True, "path": str(path), "logs": logs}
    except Exception as e:
        logger.exception("Export failed")
        return {"error": str(e), "logs": logs}


@publish_router.get("/export/{model_name}/files")
async def list_export_files(model_name: str):
    """List all exported files for a model."""
    from engine.exporter import get_export_files
    return {"files": get_export_files(model_name)}


# ── Model Card ────────────────────────────────────────────────────────────────

@publish_router.post("/model-card/{model_name}")
async def create_model_card(model_name: str):
    """Generate and save a markdown model card."""
    from engine.exporter import generate_model_card
    try:
        card = generate_model_card(model_name)
        return {"success": True, "content": card}
    except Exception as e:
        return {"error": str(e)}


# ── Docker ────────────────────────────────────────────────────────────────────

@publish_router.post("/docker/{model_name}")
async def generate_docker(model_name: str):
    """Generate Dockerfile + docker-compose.yml for the model."""
    from engine.exporter import generate_dockerfile
    dockerfile, compose = generate_dockerfile(model_name)
    return {
        "success": True,
        "dockerfile": dockerfile,
        "docker_compose": compose,
        "message": f"Files saved to exports/{model_name}/",
    }


# ── Local API Server ──────────────────────────────────────────────────────────

@publish_router.post("/server/start")
async def start_server(config: ServerConfig):
    """Start the OpenAI-compatible local API server as a subprocess."""
    global _server_process, _server_config

    if _server_process and _server_process.poll() is None:
        return {"error": "Server is already running", "pid": _server_process.pid}

    backend_dir = Path(__file__).parent.parent
    cmd = [
        sys.executable, "-m", "uvicorn",
        "server.openai_server:app",
        "--host", config.host,
        "--port", str(config.port),
    ]

    try:
        _server_process = subprocess.Popen(
            cmd,
            cwd=str(backend_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        _server_config = config.model_dump()
        logger.info(f"Local API server started on {config.host}:{config.port} (PID {_server_process.pid})")
        return {
            "success": True,
            "pid": _server_process.pid,
            "url": f"http://{config.host}:{config.port}",
            "endpoints": [
                f"GET  http://{config.host}:{config.port}/v1/models",
                f"POST http://{config.host}:{config.port}/v1/chat/completions",
                f"POST http://{config.host}:{config.port}/v1/completions",
            ],
        }
    except Exception as e:
        return {"error": str(e)}


@publish_router.post("/server/stop")
async def stop_server():
    """Stop the local API server."""
    global _server_process
    if not _server_process or _server_process.poll() is not None:
        return {"error": "Server is not running"}
    _server_process.terminate()
    _server_process.wait(timeout=5)
    _server_process = None
    return {"success": True, "message": "Server stopped"}


@publish_router.get("/server/status")
async def server_status():
    """Get the current status of the local API server."""
    global _server_process, _server_config
    if _server_process and _server_process.poll() is None:
        return {
            "running": True,
            "pid": _server_process.pid,
            "config": _server_config,
        }
    return {"running": False}
