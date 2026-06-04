use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(serde::Serialize, serde::Deserialize)]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

const BOUNDS_FILE: &str = "window-bounds.json";
const LOCK_FILE: &str = "pi-web.lock";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![toggle_titlebar, get_decorations])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let handle = app.handle().clone();

            #[cfg(debug_assertions)]
            window.open_devtools();

            // ── Single-instance lock ──────────────────────────
            {
                let lock_path = std::env::temp_dir().join(LOCK_FILE);
                if lock_path.exists() {
                    let stale = std::fs::read_to_string(&lock_path)
                        .ok()
                        .and_then(|s| s.trim().parse::<u32>().ok())
                        .map(|pid| !process_alive(pid))
                        .unwrap_or(true);
                    if stale {
                        let _ = std::fs::remove_file(&lock_path);
                    } else {
                        focus_existing_window();
                        std::process::exit(0);
                    }
                }
                let _ = std::fs::write(&lock_path, std::process::id().to_string());
            }

            // ── Window bounds persistence ──────────────────────
            {
                if let Ok(data_dir) = handle.path().app_data_dir() {
                    let bounds_path = data_dir.join(BOUNDS_FILE);
                    if let Ok(json) = std::fs::read_to_string(&bounds_path) {
                        if let Ok(b) = serde_json::from_str::<WindowBounds>(&json) {
                            let _ = window.set_position(tauri::PhysicalPosition::new(b.x, b.y));
                            let _ = window.set_size(tauri::PhysicalSize::new(b.width, b.height));
                            if b.maximized {
                                let _ = window.maximize();
                            }
                        }
                    }
                }

                let w = window.clone();
                let h = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) {
                            if let Ok(data_dir) = h.path().app_data_dir() {
                                let _ = std::fs::create_dir_all(&data_dir);
                                let bounds = WindowBounds {
                                    x: pos.x,
                                    y: pos.y,
                                    width: size.width,
                                    height: size.height,
                                    maximized: w.is_maximized().unwrap_or(false),
                                };
                                if let Ok(json) = serde_json::to_string(&bounds) {
                                    let _ = std::fs::write(data_dir.join(BOUNDS_FILE), json);
                                }
                            }
                        }
                        let lock_path = std::env::temp_dir().join(LOCK_FILE);
                        let _ = std::fs::remove_file(lock_path);
                    }
                });
            }

            // ── Global shortcuts (registered via plugin) ───────
            {
                app.global_shortcut().register("Ctrl+Shift+Space").ok();
                app.global_shortcut().register("Ctrl+Shift+N").ok();
            }

            // ── Drag-drop folders onto window ─────────────────
            {
                let h = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::DragDrop(e) = event {
                        if let tauri::DragDropEvent::Drop { paths, .. } = e {
                            for path in paths {
                                if path.is_dir() {
                                    let _ = h.emit("folder-dropped", path.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running pi-web");
}

// ── Tauri Commands ──────────────────────────────────────────────

#[tauri::command]
fn toggle_titlebar(window: tauri::WebviewWindow) -> Result<bool, String> {
    let decorated = window.is_decorated().map_err(|e| e.to_string())?;
    let new = !decorated;
    window.set_decorations(new).map_err(|e| e.to_string())?;
    let _ = window.emit("titlebar-changed", new);
    Ok(new)
}

#[tauri::command]
fn get_decorations(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_decorated().map_err(|e| e.to_string())
}

// ── Platform Helpers ────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn process_alive(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid)])
        .creation_flags(0x08000000)
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "windows"))]
fn process_alive(pid: u32) -> bool {
    if std::path::Path::new(&format!("/proc/{}", pid)).exists() {
        return true;
    }
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn focus_existing_window() {
    use std::os::windows::process::CommandExt;
    let script = r#"
        $wshell = New-Object -ComObject WScript.Shell
        $wshell.AppActivate('pi')
    "#;
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .creation_flags(0x08000000)
        .status();
}

#[cfg(not(target_os = "windows"))]
fn focus_existing_window() {}
