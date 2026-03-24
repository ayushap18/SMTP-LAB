use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// Severity level for log entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Success,
    Warning,
    Error,
    Debug,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Info => write!(f, "INFO"),
            Self::Success => write!(f, " OK "),
            Self::Warning => write!(f, "WARN"),
            Self::Error => write!(f, "ERR "),
            Self::Debug => write!(f, "DBG "),
        }
    }
}

/// A single log entry capturing one step of the SMTP handshake.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub stage: String,
    pub message: String,
    /// Raw SMTP response code, if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smtp_code: Option<u16>,
}

/// Thread-safe logger that collects entries and optionally streams them via callback.
#[derive(Clone)]
pub struct SmtpLogger {
    entries: Arc<Mutex<Vec<LogEntry>>>,
    callback: Arc<Mutex<Option<Box<dyn Fn(LogEntry) + Send + 'static>>>>,
}

impl SmtpLogger {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            callback: Arc::new(Mutex::new(None)),
        }
    }

    /// Set a callback that fires on every new log entry (for real-time UI updates).
    pub fn on_entry<F: Fn(LogEntry) + Send + 'static>(&self, f: F) {
        *self.callback.lock().unwrap() = Some(Box::new(f));
    }

    /// Record a log entry.
    pub fn log(
        &self,
        level: LogLevel,
        stage: impl Into<String>,
        message: impl Into<String>,
        smtp_code: Option<u16>,
    ) {
        let entry = LogEntry {
            timestamp: Utc::now().format("%H:%M:%S%.3f").to_string(),
            level,
            stage: stage.into(),
            message: message.into(),
            smtp_code,
        };

        if let Ok(cb) = self.callback.lock() {
            if let Some(ref f) = *cb {
                f(entry.clone());
            }
        }

        if let Ok(mut entries) = self.entries.lock() {
            entries.push(entry);
        }
    }

    /// Convenience helpers.
    pub fn info(&self, stage: impl Into<String>, msg: impl Into<String>) {
        self.log(LogLevel::Info, stage, msg, None);
    }

    pub fn success(&self, stage: impl Into<String>, msg: impl Into<String>) {
        self.log(LogLevel::Success, stage, msg, None);
    }

    pub fn warn(&self, stage: impl Into<String>, msg: impl Into<String>) {
        self.log(LogLevel::Warning, stage, msg, None);
    }

    pub fn error(&self, stage: impl Into<String>, msg: impl Into<String>) {
        self.log(LogLevel::Error, stage, msg, None);
    }

    pub fn debug(&self, stage: impl Into<String>, msg: impl Into<String>) {
        self.log(LogLevel::Debug, stage, msg, None);
    }

    pub fn smtp(&self, stage: impl Into<String>, code: u16, msg: impl Into<String>) {
        self.log(LogLevel::Info, stage, msg, Some(code));
    }

    /// Return a snapshot of all entries collected so far.
    pub fn entries(&self) -> Vec<LogEntry> {
        self.entries.lock().unwrap().clone()
    }

    /// Clear all entries.
    pub fn clear(&self) {
        self.entries.lock().unwrap().clear();
    }
}

impl Default for SmtpLogger {
    fn default() -> Self {
        Self::new()
    }
}
