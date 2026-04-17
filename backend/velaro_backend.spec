# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for bundling the Velaro FastAPI backend into a
# single-file executable: velaro-backend.exe (Windows) / velaro-backend (Unix)
#
# Build with:
#   cd backend
#   pyinstaller velaro_backend.spec

import sys
from pathlib import Path

block_cipher = None

# Collect hidden imports that PyInstaller might miss for FastAPI / uvicorn
hidden_imports = [
    # FastAPI / Starlette internals
    "uvicorn",
    "uvicorn.main",
    "uvicorn.config",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.http",
    "uvicorn.http.auto",
    "uvicorn.http.h11_impl",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "starlette.routing",
    "starlette.middleware",
    "starlette.middleware.cors",
    "fastapi",
    "fastapi.routing",
    # Our modules
    "api",
    "api.models",
    "api.training",
    "api.inference",
    "api.publish",
    "api.settings",
    "api.finetune",
    "engine",
    "engine.model",
    "engine.dataset",
    "engine.trainer",
    "engine.checkpoint",
    "engine.inference",
    "engine.exporter",
    "engine.lora",
    "server",
    "server.openai_server",
    # ML
    "torch",
    "tiktoken",
    "safetensors",
    "safetensors.torch",
    # Utilities
    "psutil",
    "multipart",
    "h11",
    "anyio",
    "anyio.abc",
    "anyio._backends._asyncio",
    "sniffio",
    "websockets",
]

a = Analysis(
    ["main.py"],
    pathex=[str(Path(".").resolve())],
    binaries=[],
    datas=[
        # Include tokenizer vocab files if present
        ("*.tiktoken", "."),
        ("*.json", "."),
    ],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "matplotlib",
        "PIL",
        "tkinter",
        "notebook",
        "IPython",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="velaro-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # keep console for log visibility
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
