#!/usr/bin/env bash
# ============================================================
# Velaro — Linux / macOS Production Build Script
# ============================================================
# Usage:
#   ./scripts/build.sh            -- full build
#   ./scripts/build.sh --skip-backend  -- skip PyInstaller
#
# Output (Linux):
#   frontend/src-tauri/target/release/bundle/deb/velaro_0.1.0_amd64.deb
#   frontend/src-tauri/target/release/bundle/appimage/velaro_0.1.0_amd64.AppImage
# Output (macOS):
#   frontend/src-tauri/target/release/bundle/dmg/velaro_0.1.0_x64.dmg
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BINARIES="$FRONTEND/src-tauri/binaries"

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

info()  { echo -e "${YELLOW}$*${NC}"; }
ok()    { echo -e "${GREEN}$*${NC}"; }
error() { echo -e "${RED}$*${NC}" >&2; exit 1; }

echo ""
ok "╔══════════════════════════════════════════════╗"
ok "║         Velaro  Production Build             ║"
ok "╚══════════════════════════════════════════════╝"
echo ""

SKIP_BACKEND=0
[[ "${1:-}" == "--skip-backend" ]] && SKIP_BACKEND=1

# ── 1. Prerequisites ─────────────────────────────────────────
info "[1/5] Checking prerequisites..."

command -v python3 &>/dev/null || error "python3 not found"
command -v node    &>/dev/null || error "node not found"
command -v cargo   &>/dev/null || error "cargo not found"

echo "   Python3: $(python3 --version)"
echo "   Node:    $(node --version)"
echo "   Cargo:   $(cargo --version)"

# ── 2. Python dependencies (in isolated venv) ────────────────
info "[2/5] Installing Python dependencies (venv)..."
cd "$BACKEND"
if [[ ! -d ".venv" ]]; then
    python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip -q
python -m pip install -r requirements.txt -q
python -m pip install pyinstaller -q
echo "   Done."

# ── 3. PyInstaller ───────────────────────────────────────────
if [[ "$SKIP_BACKEND" -eq 0 ]]; then
    info "[3/5] Building Python backend (PyInstaller)..."
    cd "$BACKEND"
    python3 -m PyInstaller velaro_backend.spec --clean --noconfirm

    mkdir -p "$BINARIES"
    cp "$BACKEND/dist/velaro-backend" "$BINARIES/velaro-backend"
    chmod +x "$BINARIES/velaro-backend"
    echo "   Backend binary → $BINARIES/velaro-backend"
else
    info "[3/5] Skipping PyInstaller (--skip-backend)"
fi

# ── 4. npm install ────────────────────────────────────────────
info "[4/5] Installing frontend dependencies..."
cd "$FRONTEND"
npm install --silent
echo "   Done."

# ── 5. Tauri build ────────────────────────────────────────────
info "[5/5] Building Tauri desktop app..."
cd "$FRONTEND"
npx tauri build

echo ""
ok "╔══════════════════════════════════════════════╗"
ok "║         Build Complete! 🎉                   ║"
ok "╚══════════════════════════════════════════════╝"
echo ""
echo "Installer: $FRONTEND/src-tauri/target/release/bundle/"
echo ""
