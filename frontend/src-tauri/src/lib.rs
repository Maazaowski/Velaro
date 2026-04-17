use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

/// Holds the spawned Python backend child process so we can kill it on exit.
struct BackendProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // ── Dev-mode logging ──────────────────────────────────────────
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ── Spawn the FastAPI backend ─────────────────────────────────
            let child = spawn_backend(app);
            *app.state::<BackendProcess>().0.lock().unwrap() = child;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Kill the backend when the app exits
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = app_handle
                    .state::<BackendProcess>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}

/// Spawn the FastAPI/uvicorn backend process.
///
/// - **Debug builds** (dev mode): calls `python -m uvicorn main:app ...`
///   from the `backend/` directory next to the project root.
/// - **Release builds**: launches the bundled `velaro-backend` sidecar
///   from the Tauri resource directory.
fn spawn_backend(app: &tauri::App) -> Option<Child> {
    if cfg!(debug_assertions) {
        // ── Development ───────────────────────────────────────────────────
        // Running from frontend/src-tauri/ via `cargo tauri dev`.
        // Walk two levels up to the project root, then into backend/.
        let tauri_dir = std::env::current_dir().unwrap_or_default();
        let backend_dir = tauri_dir
            .ancestors()
            .nth(2) // src-tauri → frontend → project root
            .map(|p| p.join("backend"))
            .unwrap_or_else(|| tauri_dir.join("../../backend"));

        // Prefer the backend's virtualenv Python if it exists,
        // otherwise fall back to the system interpreter.
        let venv_py = if cfg!(target_os = "windows") {
            backend_dir.join(".venv").join("Scripts").join("python.exe")
        } else {
            backend_dir.join(".venv").join("bin").join("python")
        };

        let py: std::ffi::OsString = if venv_py.exists() {
            venv_py.into_os_string()
        } else if cfg!(target_os = "windows") {
            "python".into()
        } else {
            "python3".into()
        };

        let child = Command::new(&py)
            .args([
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
                "--log-level",
                "warning",
            ])
            .current_dir(&backend_dir)
            .spawn();

        match child {
            Ok(c) => {
                log::info!("Backend started (dev) from {:?}", backend_dir);
                Some(c)
            }
            Err(e) => {
                log::error!("Failed to start backend (dev): {e}");
                None
            }
        }
    } else {
        // ── Production ────────────────────────────────────────────────────
        // PyInstaller bundle sits in the Tauri resource dir.
        let resource_dir = app
            .path()
            .resource_dir()
            .unwrap_or_default();

        let sidecar_name = if cfg!(target_os = "windows") {
            "velaro-backend.exe"
        } else {
            "velaro-backend"
        };

        let sidecar_path = resource_dir.join(sidecar_name);

        match Command::new(&sidecar_path).spawn() {
            Ok(c) => {
                log::info!("Backend sidecar started from {:?}", sidecar_path);
                Some(c)
            }
            Err(e) => {
                log::error!("Failed to start backend sidecar {:?}: {e}", sidecar_path);
                None
            }
        }
    }
}
