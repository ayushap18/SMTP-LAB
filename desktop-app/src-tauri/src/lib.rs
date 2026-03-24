use serde::{Deserialize, Serialize};
use smtp_core::{
    diagnostics::DiagResult,
    log::LogEntry,
    Encryption, SmtpConfig, SmtpLogger, SmtpTester,
};
use std::sync::Mutex;
use tauri::State;

/// Shared app state holding the logger for streaming logs to the frontend.
pub struct AppState {
    logger: Mutex<SmtpLogger>,
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
    pub timeout_secs: u64,
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

fn parse_encryption(s: &str) -> Encryption {
    match s.to_lowercase().as_str() {
        "ssl" | "tls" => Encryption::Ssl,
        "starttls" => Encryption::StartTls,
        _ => Encryption::None,
    }
}

/// Tauri command: run a full SMTP test.
#[tauri::command]
async fn smtp_test(input: SmtpFormInput, state: State<'_, AppState>) -> Result<SmtpTestOutput, String> {
    let config = SmtpConfig {
        host: input.host,
        port: input.port,
        encryption: parse_encryption(&input.encryption),
        username: input.username,
        password: input.password,
        from: input.from,
        to: input.to,
        subject: input.subject,
        body: input.body,
        timeout_secs: input.timeout_secs,
        auth_method: None,
    };

    let logger = SmtpLogger::new();

    // Store logger reference for potential streaming
    {
        let mut state_logger = state.logger.lock().unwrap();
        *state_logger = logger.clone();
    }

    let tester = SmtpTester::new(config, logger);
    let result = tester.run().await;

    Ok(SmtpTestOutput {
        success: result.success,
        message: result.message,
        logs: result.logs,
        elapsed_ms: result.elapsed_ms,
        diagnostics: result.diagnostics,
    })
}

/// Tauri command: run diagnostics only.
#[tauri::command]
async fn smtp_diagnose(host: String, port: u16, email: String) -> Result<DiagResult, String> {
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
        timeout_secs: 15,
        auth_method: None,
    };

    let tester = SmtpTester::new(config, logger);
    Ok(tester.diagnose().await)
}

/// Tauri command: get current log entries.
#[tauri::command]
fn get_logs(state: State<'_, AppState>) -> Vec<LogEntry> {
    state.logger.lock().unwrap().entries()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            logger: Mutex::new(SmtpLogger::new()),
        })
        .invoke_handler(tauri::generate_handler![smtp_test, smtp_diagnose, get_logs])
        .run(tauri::generate_context!())
        .expect("error while running SMTP Lab");
}
