@echo off
:: ============================================================
:: Velaro — Windows Production Build Script
:: ============================================================
:: Usage:
::   scripts\build.bat           — full build
::   scripts\build.bat --skip-backend  — skip PyInstaller step
::
:: Output:
::   frontend\src-tauri\target\release\bundle\nsis\Velaro_0.1.0_x64-setup.exe
:: ============================================================

setlocal enabledelayedexpansion

set "ROOT=%~dp0.."
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "BINARIES=%FRONTEND%\src-tauri\binaries"

:: Colour helpers (works on Win10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "RESET=[0m"

echo.
echo %GREEN%╔══════════════════════════════════════════════╗%RESET%
echo %GREEN%║         Velaro  Production Build             ║%RESET%
echo %GREEN%╚══════════════════════════════════════════════╝%RESET%
echo.

:: ── 1. Parse arguments ───────────────────────────────────────
set SKIP_BACKEND=0
if "%1"=="--skip-backend" set SKIP_BACKEND=1

:: ── 2. Check prerequisites ───────────────────────────────────
echo %YELLOW%[1/5] Checking prerequisites...%RESET%

where python >nul 2>&1 || (
    echo %RED%ERROR: python not found. Install Python 3.10+ and add to PATH.%RESET%
    exit /b 1
)

where node >nul 2>&1 || (
    echo %RED%ERROR: node not found. Install Node.js 18+.%RESET%
    exit /b 1
)

where cargo >nul 2>&1 || (
    echo %RED%ERROR: cargo not found. Install Rust from https://rustup.rs/%RESET%
    exit /b 1
)

echo    Python: OK
echo    Node:   OK
echo    Cargo:  OK

:: ── 3. Install Python dependencies (in isolated venv) ────────
echo.
echo %YELLOW%[2/5] Installing Python dependencies (venv)...%RESET%
cd /d "%BACKEND%"
if not exist ".venv" (
    python -m venv .venv || (
        echo %RED%ERROR: failed to create venv%RESET%
        exit /b 1
    )
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet || (
    echo %RED%ERROR: pip install failed%RESET%
    exit /b 1
)
python -m pip install pyinstaller --quiet || (
    echo %RED%ERROR: pyinstaller install failed%RESET%
    exit /b 1
)
echo    Done.

:: ── 4. Build Python backend with PyInstaller ─────────────────
if "%SKIP_BACKEND%"=="0" (
    echo.
    echo %YELLOW%[3/5] Building Python backend (PyInstaller)...%RESET%
    cd /d "%BACKEND%"
    python -m PyInstaller velaro_backend.spec --clean --noconfirm || (
        echo %RED%ERROR: PyInstaller build failed%RESET%
        exit /b 1
    )

    :: Copy the exe next to the Tauri release binary so it ships in the installer
    set "RELEASE_DIR=%FRONTEND%\src-tauri\target\release"
    if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
    copy /Y "%BACKEND%\dist\velaro-backend.exe" "%RELEASE_DIR%\velaro-backend.exe" || (
        echo %RED%ERROR: Failed to copy velaro-backend.exe%RESET%
        exit /b 1
    )
    :: Also keep a copy in binaries/ for reference
    if not exist "%BINARIES%" mkdir "%BINARIES%"
    copy /Y "%BACKEND%\dist\velaro-backend.exe" "%BINARIES%\velaro-backend.exe" >nul
    echo    Backend exe → %RELEASE_DIR%\velaro-backend.exe
) else (
    echo.
    echo %YELLOW%[3/5] Skipping PyInstaller (--skip-backend)%RESET%
)

:: ── 5. Install Node dependencies ─────────────────────────────
echo.
echo %YELLOW%[4/5] Installing frontend dependencies...%RESET%
cd /d "%FRONTEND%"
call npm install --silent || (
    echo %RED%ERROR: npm install failed%RESET%
    exit /b 1
)
echo    Done.

:: ── 6. Tauri production build ─────────────────────────────────
echo.
echo %YELLOW%[5/5] Building Tauri desktop app...%RESET%
cd /d "%FRONTEND%"
call npx tauri build || (
    echo %RED%ERROR: Tauri build failed%RESET%
    exit /b 1
)

echo.
echo %GREEN%╔══════════════════════════════════════════════╗%RESET%
echo %GREEN%║         Build Complete! 🎉                   ║%RESET%
echo %GREEN%╚══════════════════════════════════════════════╝%RESET%
echo.
echo Installer: %FRONTEND%\src-tauri\target\release\bundle\nsis\
echo.
endlocal
