# Velaro

**Build, train, and deploy your own local LLM models — no code required.**

Velaro is a no-code desktop application that gives anyone the ability to create, train, test, and publish their own language models directly on their own machine. Configure a GPT-style Transformer architecture with sliders, watch it train with live loss charts and resource meters, chat with it in the built-in playground, and export or serve it via an OpenAI-compatible API — all without writing a single line of code.

---

## Screenshots

> *Coming soon — run the app with `npm run dev` to see the UI live.*

---

## Features

| Area | Capabilities |
|---|---|
| **Create** | 6-step wizard: name & use-case → architecture → model config → dataset → hyperparameters → review |
| **Train** | Live loss/validation charts, GPU/CPU/RAM meters, pause/resume/stop, auto-checkpointing |
| **Playground** | Token-by-token streaming chat, generation settings (temperature, top-k, top-p), benchmark mode |
| **Publish** | OpenAI-compatible local API server, SafeTensors/ONNX/INT8/FP16 export, Docker + model card generation |
| **Settings** | Device/precision settings, LoRA fine-tuning on existing models, import from HuggingFace Hub or local file |
| **Desktop** | Native Tauri window, Python backend auto-starts on launch, splash screen with health polling |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| State management | Zustand |
| Charts | Recharts |
| Icons | lucide-react |
| Backend | FastAPI + uvicorn (Python) |
| ML engine | PyTorch — GPT-style decoder-only Transformer |
| Tokenizer | tiktoken (BPE) |
| Checkpoints | SafeTensors |
| Fine-tuning | LoRA (Low-Rank Adaptation) |
| Streaming | WebSockets (training metrics + token generation) |

---

## Project Structure

```
Velaro/
├── backend/                  # Python FastAPI backend
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt
│   ├── velaro_backend.spec   # PyInstaller build spec
│   ├── api/
│   │   ├── models.py         # Model CRUD + import endpoints
│   │   ├── training.py       # Training start/pause/resume/stop + WebSocket
│   │   ├── inference.py      # Load/generate REST + WebSocket streaming
│   │   ├── publish.py        # Export, API server control, Docker, model card
│   │   ├── settings.py       # App settings load/save
│   │   ├── finetune.py       # LoRA fine-tuning endpoint
│   │   └── routes.py         # Router registration
│   ├── engine/
│   │   ├── model.py          # VelaroGPT — CausalSelfAttention + TransformerBlock
│   │   ├── dataset.py        # TextDataset, dataloader, HF/local/paste sources
│   │   ├── trainer.py        # Training loop — AMP, grad accumulation, schedulers
│   │   ├── checkpoint.py     # Save/load/list checkpoints (keeps last 3 + best)
│   │   ├── inference.py      # Model cache, generate_tokens() iterator
│   │   ├── exporter.py       # SafeTensors, ONNX, INT8/FP16 quantization
│   │   └── lora.py           # LoRALinear, inject_lora(), merge_lora_weights()
│   └── server/
│       └── openai_server.py  # OpenAI-compatible /v1/models + /v1/chat/completions
│
├── frontend/                 # React + Tauri frontend
│   ├── src/
│   │   ├── App.tsx           # Router + splash screen gate
│   │   ├── main.tsx
│   │   ├── styles/theme.css  # CSS variables + shared component classes
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx   # Nav + live CPU/RAM/GPU bars (polls every 3 s)
│   │   │   ├── Topbar.tsx
│   │   │   └── SplashScreen.tsx  # Backend health polling on startup
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # Model list (real API) + CRUD context menu
│   │   │   ├── CreateModel.tsx   # 6-step wizard shell
│   │   │   ├── Training.tsx      # Live training monitor
│   │   │   ├── Playground.tsx    # Chat + benchmark
│   │   │   ├── Publish.tsx       # Deploy modes: API / Export / Docker
│   │   │   └── SettingsPage.tsx  # Compute, general, notifications, import, fine-tune
│   │   └── stores/
│   │       ├── wizardStore.ts    # Model creation state + VRAM estimates
│   │       ├── trainingStore.ts  # WebSocket metrics + rolling history
│   │       ├── playgroundStore.ts# Chat messages, streaming, benchmark
│   │       ├── publishStore.ts   # Export/server/docker actions
│   │       ├── modelStore.ts     # Model CRUD + HF/local import
│   │       └── settingsStore.ts  # App settings (persisted to localStorage + backend)
│   └── src-tauri/
│       ├── tauri.conf.json   # Window config, bundle settings, NSIS installer
│       └── src/lib.rs        # Spawn/kill Python backend sidecar
│
├── scripts/
│   ├── build.bat             # Windows one-click production build
│   └── build.sh              # Linux/macOS one-click production build
│
└── wireframe/
    └── index.html            # Interactive HTML prototype (5 screens)
```

---

## Getting Started (Development)

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Python | 3.10+ | https://python.org |
| Rust + Cargo | latest stable | https://rustup.rs |

### 1. Clone the repo

```bash
git clone https://github.com/your-username/velaro.git
cd velaro
```

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run in development mode

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend + Tauri:**
```bash
cd frontend
npm run tauri dev
```

The Tauri window will open. The splash screen polls the backend health endpoint and fades out once the API is ready.

> **Note:** When using `npm run tauri dev`, Tauri automatically tries to start the backend via `lib.rs`. If you prefer to manage the backend manually (e.g. for `--reload`), start it in Terminal 1 before running `npm run tauri dev`.

---

## Production Build

Run the all-in-one build script from the project root:

**Windows:**
```bat
scripts\build.bat
```

**Linux / macOS:**
```bash
chmod +x scripts/build.sh
./scripts/build.sh
```

The script:
1. Installs Python + Node dependencies
2. Bundles the FastAPI backend into a single exe with **PyInstaller**
3. Builds the React frontend (`npm run build`)
4. Compiles and bundles everything with **`tauri build`**

Output installer:
- **Windows:** `frontend/src-tauri/target/release/bundle/nsis/Velaro_0.1.0_x64-setup.exe`
- **Linux:** `frontend/src-tauri/target/release/bundle/appimage/`
- **macOS:** `frontend/src-tauri/target/release/bundle/dmg/`

To skip the PyInstaller step (e.g. if the backend hasn't changed):
```bat
scripts\build.bat --skip-backend
```

---

## Backend API Reference

The backend runs at `http://localhost:8000`. All routes are prefixed with `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/system/stats` | Live CPU/RAM/GPU metrics |
| `GET` | `/api/system/models` | List all models |
| `POST` | `/api/system/models` | Create model config |
| `DELETE` | `/api/system/models/{name}` | Delete model |
| `PATCH` | `/api/system/models/{name}/rename` | Rename model |
| `POST` | `/api/system/models/{name}/clone` | Clone model |
| `POST` | `/api/system/models/import/huggingface` | Import from HuggingFace Hub |
| `POST` | `/api/system/models/import/local` | Import local checkpoint |
| `POST` | `/api/training/start` | Start training run |
| `POST` | `/api/training/pause` | Pause training |
| `POST` | `/api/training/resume` | Resume training |
| `POST` | `/api/training/stop` | Stop training |
| `WS` | `/api/training/ws/{model_name}` | Live training metrics stream |
| `POST` | `/api/inference/load` | Load model into memory |
| `POST` | `/api/inference/generate` | Generate text (REST) |
| `WS` | `/api/inference/ws/generate` | Token-by-token streaming |
| `POST` | `/api/publish/export` | Export model (SafeTensors/ONNX/quantized) |
| `POST` | `/api/publish/server/start` | Start OpenAI-compatible API server |
| `POST` | `/api/publish/server/stop` | Stop API server |
| `GET` | `/api/publish/server/status` | Server status + port |
| `POST` | `/api/publish/docker` | Generate Dockerfile + compose |
| `POST` | `/api/publish/model-card` | Generate model card markdown |
| `GET` | `/api/settings` | Load app settings |
| `POST` | `/api/settings` | Save app settings |
| `POST` | `/api/finetune/start` | Start LoRA fine-tune job |
| `GET` | `/api/finetune/status/{name}` | Fine-tune job status |

The published API server also exposes an **OpenAI-compatible endpoint** on a configurable port:

```
GET  /v1/models
POST /v1/chat/completions
POST /v1/completions
```

---

## Model Architecture

Velaro trains a **GPT-style decoder-only Transformer** (same family as GPT-2):

- Causal self-attention with configurable heads
- Pre-norm with LayerNorm
- GELU MLP with 4× hidden expansion
- BPE tokenization via tiktoken
- Weight tying (embedding ↔ output projection)
- Supports FP32 / FP16 / BF16 mixed precision
- Gradient accumulation and cosine/linear/constant LR schedulers

**Supported model sizes** (wizard presets):

| Preset | Params | Layers | Hidden | Heads |
|---|---|---|---|---|
| Nano | ~15M | 6 | 384 | 6 |
| Small | ~125M | 12 | 768 | 12 |
| Medium | ~350M | 24 | 1024 | 16 |
| Large | ~760M | 36 | 1280 | 20 |
| Custom | any | — | — | — |

---

## Fine-Tuning with LoRA

Velaro supports **LoRA (Low-Rank Adaptation)** for efficient fine-tuning of existing models. Instead of retraining all weights, LoRA adds small trainable rank-decomposition matrices into the attention layers — typically training less than 1% of parameters while preserving the base model's knowledge.

Configure via **Settings → Fine-Tune**:
- Select any `ready` or `published` base model
- Paste training text or point to a file / HuggingFace dataset
- Set LoRA rank (r), alpha (α), and learning rate
- The fine-tuned model is saved as a new model entry

---

## License

MIT — see [LICENSE](LICENSE)
