use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::{Result, SmtpLabError};

/// Encryption mode for the SMTP connection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Encryption {
    /// No encryption (plain text) — port 25 typically.
    None,
    /// Implicit TLS (SMTPS) — port 465 typically.
    Ssl,
    /// Upgrade via STARTTLS — port 587 typically.
    StartTls,
}

impl std::fmt::Display for Encryption {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "None"),
            Self::Ssl => write!(f, "SSL/TLS"),
            Self::StartTls => write!(f, "STARTTLS"),
        }
    }
}

/// Authentication mechanism.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AuthMethod {
    Plain,
    Login,
}

/// Full configuration for an SMTP test session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub encryption: Encryption,

    /// Username for authentication (optional — skip auth if empty).
    #[serde(default)]
    pub username: String,

    /// Password — never logged in plain text.
    #[serde(default)]
    pub password: String,

    pub from: String,
    pub to: String,

    #[serde(default = "default_subject")]
    pub subject: String,

    #[serde(default = "default_body")]
    pub body: String,

    /// Optional HTML body for multipart emails.
    #[serde(default)]
    pub html_body: Option<String>,

    /// List of file paths to attach.
    #[serde(default)]
    pub attachments: Vec<String>,

    /// Connection timeout in seconds.
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,

    #[serde(default)]
    pub auth_method: Option<AuthMethod>,
}

fn default_subject() -> String {
    "SMTP Lab Test Email".into()
}

fn default_body() -> String {
    "This is a test email sent by SMTP Lab.".into()
}

fn default_timeout() -> u64 {
    30
}

impl SmtpConfig {
    /// Returns true if authentication credentials were provided.
    pub fn has_auth(&self) -> bool {
        !self.username.is_empty() && !self.password.is_empty()
    }

    /// Basic validation of required fields.
    pub fn validate(&self) -> Result<()> {
        if self.host.is_empty() {
            return Err(SmtpLabError::Config("Host is required".into()));
        }
        if self.from.is_empty() {
            return Err(SmtpLabError::Config("From address is required".into()));
        }
        if self.to.is_empty() {
            return Err(SmtpLabError::Config("To address is required".into()));
        }
        Ok(())
    }
}

/// A saved SMTP server profile (password is NOT stored).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpProfile {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub encryption: Encryption,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub description: String,
    pub created_at: String,
}

/// An email template that can be reused.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub name: String,
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: String,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
}

/// Retry configuration for SMTP tests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retry attempts (0 means no retries).
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// Backoff between retries in milliseconds.
    #[serde(default = "default_backoff_ms")]
    pub backoff_ms: u64,
}

fn default_max_retries() -> u32 {
    0
}

fn default_backoff_ms() -> u64 {
    1000
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: default_max_retries(),
            backoff_ms: default_backoff_ms(),
        }
    }
}

/// Application-level configuration loaded from `.smtplab.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub default_profile: Option<String>,
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub retry: RetryConfig,
    #[serde(default = "default_history_dir")]
    pub history_dir: String,
}

fn default_history_dir() -> String {
    "~/.smtplab/history".into()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            default_profile: None,
            timeout: default_timeout(),
            retry: RetryConfig::default(),
            history_dir: default_history_dir(),
        }
    }
}

/// Load application config from a TOML file.
pub fn load_config(path: &Path) -> Result<AppConfig> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| SmtpLabError::Config(format!("Failed to read config file: {e}")))?;
    let config: AppConfig = toml::from_str(&content)
        .map_err(|e| SmtpLabError::Config(format!("Failed to parse config TOML: {e}")))?;
    Ok(config)
}

/// Save application config to a TOML file.
pub fn save_config(path: &Path, config: &AppConfig) -> Result<()> {
    let content = toml::to_string_pretty(config)
        .map_err(|e| SmtpLabError::Config(format!("Failed to serialize config: {e}")))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content)?;
    Ok(())
}
