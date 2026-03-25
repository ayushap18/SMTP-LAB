use serde::{Deserialize, Serialize};
use smtp_core::{
    diagnostics::{self, DiagResult, MxRecord},
    log::LogEntry,
    Encryption, SmtpConfig, SmtpLogger, SmtpTester,
};
use std::path::PathBuf;
use std::sync::Mutex;
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::net::{Shutdown, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};
use tauri::State;
use tokio::task::spawn_blocking;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------

pub struct AppState {
    logger: Mutex<SmtpLogger>,
    profiles: Mutex<Vec<SmtpProfile>>,
    history: Mutex<Vec<HistoryEntry>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            logger: Mutex::new(SmtpLogger::new()),
            profiles: Mutex::new(Vec::new()),
            history: Mutex::new(Vec::new()),
        }
    }

    fn data_dir() -> PathBuf {
        let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join("com.smtplab.app")
    }

    fn profiles_path() -> PathBuf {
        Self::data_dir().join("profiles.json")
    }

    fn history_path() -> PathBuf {
        Self::data_dir().join("history.json")
    }

    fn load_profiles(&self) {
        let path = Self::profiles_path();
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(profiles) = serde_json::from_str::<Vec<SmtpProfile>>(&data) {
                    *self.profiles.lock().unwrap() = profiles;
                }
            }
        }
    }

    fn persist_profiles(&self) {
        let dir = Self::data_dir();
        let _ = std::fs::create_dir_all(&dir);
        let profiles = self.profiles.lock().unwrap();
        if let Ok(data) = serde_json::to_string_pretty(&*profiles) {
            let _ = std::fs::write(Self::profiles_path(), data);
        }
    }

    fn load_history(&self) {
        let path = Self::history_path();
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(history) = serde_json::from_str::<Vec<HistoryEntry>>(&data) {
                    *self.history.lock().unwrap() = history;
                }
            }
        }
    }

    fn persist_history(&self) {
        let dir = Self::data_dir();
        let _ = std::fs::create_dir_all(&dir);
        let history = self.history.lock().unwrap();
        if let Ok(data) = serde_json::to_string_pretty(&*history) {
            let _ = std::fs::write(Self::history_path(), data);
        }
    }
}

// ---------------------------------------------------------------------------
// Local types (some mirror smtp_core, some are desktop-specific)
// ---------------------------------------------------------------------------

/// SMTP server profile saved by the user.
// TODO: replace with smtp_core::SmtpProfile when stabilised
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpProfile {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub encryption: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub description: String,
    pub created_at: String,
}

/// A record of a past SMTP test run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub host: String,
    pub port: u16,
    pub encryption: String,
    pub from: String,
    pub to: String,
    pub success: bool,
    pub message: String,
    pub elapsed_ms: u64,
    pub logs: Vec<LogEntry>,
}

/// Input from the frontend form.
#[derive(Debug, Deserialize)]
pub struct SmtpFormInput {
    pub host: String,
    pub port: u16,
    pub encryption: String,
    pub username: String,
    pub password: String,
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: String,
    #[serde(default)]
    pub html_body: Option<String>,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

/// Result sent back to the frontend.
#[derive(Debug, Serialize)]
pub struct SmtpTestOutput {
    pub success: bool,
    pub message: String,
    pub logs: Vec<LogEntry>,
    pub elapsed_ms: u64,
    pub diagnostics: Option<DiagResult>,
}

/// Result of a lightweight SMTP connectivity ping (no auth, no email).
#[derive(Debug, Serialize)]
pub struct PingResult {
    pub reachable: bool,
    pub latency_ms: u64,
    pub banner: String,
    pub error: Option<String>,
}

fn parse_encryption(s: &str) -> Encryption {
    match s.to_lowercase().as_str() {
        "ssl" | "tls" => Encryption::Ssl,
        "starttls" => Encryption::StartTls,
        _ => Encryption::None,
    }
}

// ---------------------------------------------------------------------------
// SMTP Commands
// ---------------------------------------------------------------------------

/// Run a full SMTP test: connect, auth, send.
#[tauri::command]
async fn smtp_test(
    input: SmtpFormInput,
    state: State<'_, AppState>,
) -> Result<SmtpTestOutput, String> {
    let encryption = parse_encryption(&input.encryption);
    let config = SmtpConfig {
        host: input.host.clone(),
        port: input.port,
        encryption,
        username: input.username,
        password: input.password,
        from: input.from.clone(),
        to: input.to.clone(),
        subject: input.subject,
        body: input.body,
        html_body: None,
        attachments: vec![],
        timeout_secs: input.timeout_secs.unwrap_or(30),
        auth_method: None,
    };

    let logger = SmtpLogger::new();
    {
        let mut state_logger = state.logger.lock().unwrap();
        *state_logger = logger.clone();
    }

    let tester = SmtpTester::new(config, logger);
    let result = tester.run().await;

    // Record in history
    let entry = HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        host: input.host,
        port: input.port,
        encryption: input.encryption,
        from: input.from,
        to: input.to,
        success: result.success,
        message: result.message.clone(),
        elapsed_ms: result.elapsed_ms,
        logs: result.logs.clone(),
    };
    {
        let mut history = state.history.lock().unwrap();
        history.insert(0, entry);
        // Keep last 500 entries
        history.truncate(500);
    }
    state.persist_history();

    Ok(SmtpTestOutput {
        success: result.success,
        message: result.message,
        logs: result.logs,
        elapsed_ms: result.elapsed_ms,
        diagnostics: result.diagnostics,
    })
}

/// Run diagnostics only (DNS, STARTTLS, certificate).
#[tauri::command]
async fn smtp_diagnose(
    host: String,
    port: u16,
    email: String,
) -> Result<DiagResult, String> {
    let logger = SmtpLogger::new();
    let config = SmtpConfig {
        host,
        port,
        encryption: Encryption::StartTls,
        username: String::new(),
        password: String::new(),
        from: email.clone(),
        to: email,
        subject: String::new(),
        body: String::new(),
        html_body: None,
        attachments: vec![],
        timeout_secs: 15,
        auth_method: None,
    };

    let tester = SmtpTester::new(config, logger);
    Ok(tester.diagnose().await)
}

/// TCP + EHLO connectivity check. No auth, no email sent.
/// Timer: starts after connect, stops after reading EHLO response (excludes QUIT).
#[tauri::command]
async fn smtp_ping(host: String, port: u16) -> Result<PingResult, String> {
    spawn_blocking(move || {
        let addr_str = format!("{host}:{port}");
        let addr = match addr_str.to_socket_addrs() {
            Ok(mut iter) => match iter.next() {
                Some(a) => a,
                None => return PingResult {
                    reachable: false, latency_ms: 0,
                    banner: String::new(),
                    error: Some("Could not resolve hostname".into()),
                },
            },
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("DNS error: {e}")),
            },
        };

        let start = Instant::now();

        let stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
            Ok(s) => s,
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Connection failed: {e}")),
            },
        };

        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

        let mut reader = BufReader::new(match stream.try_clone() {
            Ok(s) => s,
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Stream clone error: {e}")),
            },
        });
        let mut stream_w = stream;

        // Read SMTP banner
        let mut banner = String::new();
        if let Err(e) = reader.read_line(&mut banner) {
            return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Banner read error: {e}")),
            };
        }

        // Send EHLO
        if let Err(e) = stream_w.write_all(b"EHLO smtplab\r\n") {
            return PingResult {
                reachable: false, latency_ms: 0,
                banner: banner.trim().to_string(),
                error: Some(format!("EHLO write error: {e}")),
            };
        }

        // Read EHLO response (SMTP multi-line: "250-" continues, "250 " is last)
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).is_err() { break; }
            if line.len() >= 4 && &line[3..4] == " " { break; }
            if line.len() < 4 { break; }
        }

        // Stop timer here — latency covers connect + banner + EHLO response
        let latency_ms = start.elapsed().as_millis() as u64;

        // Clean disconnect
        let _ = stream_w.write_all(b"QUIT\r\n");
        let _ = stream_w.shutdown(Shutdown::Both);

        PingResult {
            reachable: true,
            latency_ms,
            banner: banner.trim().to_string(),
            error: None,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Profile Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_profiles(state: State<'_, AppState>) -> Vec<SmtpProfile> {
    state.profiles.lock().unwrap().clone()
}

#[tauri::command]
fn save_profile(profile: SmtpProfile, state: State<'_, AppState>) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    // Upsert by name
    if let Some(existing) = profiles.iter_mut().find(|p| p.name == profile.name) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }
    drop(profiles);
    state.persist_profiles();
    Ok(())
}

#[tauri::command]
fn delete_profile(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    let len_before = profiles.len();
    profiles.retain(|p| p.name != name);
    if profiles.len() == len_before {
        return Err(format!("Profile '{}' not found", name));
    }
    drop(profiles);
    state.persist_profiles();
    Ok(())
}

// ---------------------------------------------------------------------------
// History Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_history(limit: Option<usize>, state: State<'_, AppState>) -> Vec<HistoryEntry> {
    let history = state.history.lock().unwrap();
    let limit = limit.unwrap_or(100).min(500);
    history.iter().take(limit).cloned().collect()
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.history.lock().unwrap().clear();
    state.persist_history();
    Ok(())
}

// ---------------------------------------------------------------------------
// DNS Commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn dns_mx_lookup(domain: String) -> Result<Vec<MxRecord>, String> {
    let logger = SmtpLogger::new();
    diagnostics::lookup_mx(&domain, &logger)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn dns_check_spf(domain: String) -> Result<Option<String>, String> {
    let resolver =
        TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());
    let lookup = resolver
        .txt_lookup(&domain)
        .await
        .map_err(|e| format!("TXT lookup failed: {e}"))?;

    for record in lookup.iter() {
        let txt = record.to_string();
        if txt.starts_with("v=spf1") {
            return Ok(Some(txt));
        }
    }
    Ok(None)
}

#[tauri::command]
async fn dns_check_dkim(domain: String, selector: String) -> Result<Option<String>, String> {
    let resolver =
        TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());
    let lookup_name = format!("{selector}._domainkey.{domain}");
    let lookup = resolver
        .txt_lookup(&lookup_name)
        .await
        .map_err(|e| format!("DKIM lookup failed: {e}"))?;

    for record in lookup.iter() {
        let txt = record.to_string();
        if txt.contains("v=DKIM1") {
            return Ok(Some(txt));
        }
    }
    Ok(None)
}

#[tauri::command]
async fn dns_check_dmarc(domain: String) -> Result<Option<String>, String> {
    let resolver =
        TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());
    let lookup_name = format!("_dmarc.{domain}");
    let lookup = resolver
        .txt_lookup(&lookup_name)
        .await
        .map_err(|e| format!("DMARC lookup failed: {e}"))?;

    for record in lookup.iter() {
        let txt = record.to_string();
        if txt.starts_with("v=DMARC1") {
            return Ok(Some(txt));
        }
    }
    Ok(None)
}

// ---------------------------------------------------------------------------
// Log Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_logs(state: State<'_, AppState>) -> Vec<LogEntry> {
    state.logger.lock().unwrap().entries()
}

#[tauri::command]
fn export_logs(format: String, state: State<'_, AppState>) -> Result<String, String> {
    let entries = state.logger.lock().unwrap().entries();
    match format.as_str() {
        "json" => serde_json::to_string_pretty(&entries).map_err(|e| e.to_string()),
        "text" | _ => {
            let lines: Vec<String> = entries
                .iter()
                .map(|e| {
                    format!(
                        "{} [{}] {} {}",
                        e.timestamp, e.level, e.stage, e.message
                    )
                })
                .collect();
            Ok(lines.join("\n"))
        }
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    app_state.load_profiles();
    app_state.load_history();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            smtp_test,
            smtp_diagnose,
            smtp_ping,
            list_profiles,
            save_profile,
            delete_profile,
            list_history,
            clear_history,
            dns_mx_lookup,
            dns_check_spf,
            dns_check_dkim,
            dns_check_dmarc,
            get_logs,
            export_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SMTP Lab");
}
