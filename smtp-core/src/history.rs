use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

use crate::error::{Result, SmtpLabError};

/// A single test history entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub config_summary: String,
    pub success: bool,
    pub message: String,
    pub elapsed_ms: u64,
    #[serde(default)]
    pub logs_path: Option<String>,
}

impl HistoryEntry {
    /// Create a new history entry with an auto-generated UUID and current timestamp.
    pub fn new(
        config_summary: String,
        success: bool,
        message: String,
        elapsed_ms: u64,
        logs_path: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            config_summary,
            success,
            message,
            elapsed_ms,
            logs_path,
        }
    }
}

/// Save a history entry as a JSON file.
pub fn save_history(dir: &Path, entry: &HistoryEntry) -> Result<()> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(format!("{}.json", entry.id));
    let content = serde_json::to_string_pretty(entry)
        .map_err(|e| SmtpLabError::History(format!("Failed to serialize history entry: {e}")))?;
    std::fs::write(&path, content)?;
    Ok(())
}

/// List history entries, most recent first, up to `limit`.
pub fn list_history(dir: &Path, limit: usize) -> Vec<HistoryEntry> {
    if !dir.exists() {
        return Vec::new();
    }

    let mut entries = Vec::new();
    if let Ok(dir_entries) = std::fs::read_dir(dir) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(he) = serde_json::from_str::<HistoryEntry>(&content) {
                        entries.push(he);
                    }
                }
            }
        }
    }

    // Sort by timestamp descending (most recent first).
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    entries.truncate(limit);
    entries
}

/// Get a specific history entry by ID.
pub fn get_history(dir: &Path, id: &str) -> Option<HistoryEntry> {
    let path = dir.join(format!("{id}.json"));
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str::<HistoryEntry>(&content).ok()
}

/// Clear all history entries.
pub fn clear_history(dir: &Path) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                std::fs::remove_file(&path)?;
            }
        }
    }
    Ok(())
}
