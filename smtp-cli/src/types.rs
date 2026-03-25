//! Placeholder types for features that smtp-core will eventually provide.
//! These can be swapped out once the core library exposes the real types.

use serde::{Deserialize, Serialize};

/// A saved connection profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub encryption: String,
    pub username: String,
    #[serde(default)]
    pub password: String,
    pub from: String,
    pub to: String,
}

/// A record of a past test run, persisted to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub host: String,
    pub port: u16,
    pub success: bool,
    pub message: String,
    pub elapsed_ms: u64,
}

/// A single target in a batch configuration file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTarget {
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_encryption")]
    pub encryption: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    pub from: String,
    pub to: String,
    #[serde(default = "default_subject")]
    pub subject: String,
    #[serde(default = "default_body")]
    pub body: String,
}

/// Top-level structure of a batch TOML file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchConfig {
    #[serde(rename = "target")]
    pub targets: Vec<BatchTarget>,
}

/// Application-wide config file (.smtplab.toml).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub defaults: AppDefaults,
    #[serde(default)]
    pub profiles: Vec<Profile>,
    #[serde(default)]
    pub history: Vec<HistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppDefaults {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_encryption")]
    pub encryption: String,
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub to: String,
    #[serde(default)]
    pub host: String,
    #[serde(default = "default_subject")]
    pub subject: String,
    #[serde(default = "default_body")]
    pub body: String,
    #[serde(default = "default_dkim_selector")]
    pub dkim_selector: String,
}

impl Default for AppDefaults {
    fn default() -> Self {
        Self {
            port: default_port(),
            encryption: default_encryption(),
            timeout: default_timeout(),
            from: String::new(),
            to: String::new(),
            host: String::new(),
            subject: default_subject(),
            body: default_body(),
            dkim_selector: default_dkim_selector(),
        }
    }
}

fn default_port() -> u16 {
    587
}
fn default_encryption() -> String {
    "starttls".into()
}
fn default_timeout() -> u64 {
    30
}
fn default_subject() -> String {
    "SMTP Lab Test Email".into()
}
fn default_body() -> String {
    "This is a test email sent by SMTP Lab.".into()
}
fn default_dkim_selector() -> String {
    "google".into()
}
