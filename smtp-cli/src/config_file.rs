//! Config file auto-detection and management.

use crate::types::{AppConfig, HistoryEntry, Profile};
use std::path::PathBuf;

/// Search for `.smtplab.toml` in the current directory, then home directory.
/// Returns the path if found.
pub fn find_config_file() -> Option<PathBuf> {
    // Check current directory first
    let cwd = std::env::current_dir().ok()?;
    let local = cwd.join(".smtplab.toml");
    if local.is_file() {
        return Some(local);
    }

    // Check home directory
    if let Some(home) = dirs::home_dir() {
        let home_config = home.join(".smtplab.toml");
        if home_config.is_file() {
            return Some(home_config);
        }
    }

    None
}

/// Load the app config from the auto-detected location, or return a default.
pub fn load_config() -> AppConfig {
    match find_config_file() {
        Some(path) => match std::fs::read_to_string(&path) {
            Ok(contents) => toml::from_str(&contents).unwrap_or_default(),
            Err(_) => AppConfig::default(),
        },
        None => AppConfig::default(),
    }
}

/// Get the path where config should be written (current directory).
pub fn config_path() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".smtplab.toml")
}

/// Save the config to disk.
pub fn save_config(config: &AppConfig) -> std::io::Result<()> {
    let path = config_path();
    let contents = toml::to_string_pretty(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    std::fs::write(path, contents)
}

/// Create a default template config file.
pub fn create_template() -> std::io::Result<PathBuf> {
    let path = config_path();
    let template = r#"# SMTP Lab Configuration
# This file provides default values for smtp-test commands.
# Flags on the command line always override these defaults.

[defaults]
# host = "smtp.example.com"
# port = 587
# encryption = "starttls"  # none | ssl | starttls
# timeout = 30
# from = "you@example.com"
# to = "recipient@example.com"
# subject = "SMTP Lab Test Email"
# body = "This is a test email sent by SMTP Lab."
# dkim_selector = "google"

# [[profiles]]
# name = "gmail"
# host = "smtp.gmail.com"
# port = 587
# encryption = "starttls"
# username = "you@gmail.com"
# password = ""
# from = "you@gmail.com"
# to = "test@example.com"
"#;
    std::fs::write(&path, template)?;
    Ok(path)
}

/// Look up a profile by name.
pub fn find_profile(config: &AppConfig, name: &str) -> Option<Profile> {
    config.profiles.iter().find(|p| p.name == name).cloned()
}

/// Add a profile to the config and save.
pub fn add_profile(config: &mut AppConfig, profile: Profile) -> std::io::Result<()> {
    // Remove existing profile with the same name
    config.profiles.retain(|p| p.name != profile.name);
    config.profiles.push(profile);
    save_config(config)
}

/// Remove a profile by name.
pub fn remove_profile(config: &mut AppConfig, name: &str) -> std::io::Result<bool> {
    let before = config.profiles.len();
    config.profiles.retain(|p| p.name != name);
    let removed = config.profiles.len() < before;
    save_config(config)?;
    Ok(removed)
}

/// Append a history entry and save.
pub fn add_history_entry(config: &mut AppConfig, entry: HistoryEntry) -> std::io::Result<()> {
    config.history.push(entry);
    save_config(config)
}

/// Clear all history entries and save.
pub fn clear_history(config: &mut AppConfig) -> std::io::Result<()> {
    config.history.clear();
    save_config(config)
}
