use std::path::Path;

use crate::config::SmtpProfile;
use crate::error::{Result, SmtpLabError};

/// List all saved profiles from the profiles directory.
pub fn list_profiles(config_dir: &Path) -> Vec<SmtpProfile> {
    let profiles_dir = config_dir.join("profiles");
    if !profiles_dir.exists() {
        return Vec::new();
    }

    let mut profiles = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&profiles_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("toml") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(profile) = toml::from_str::<SmtpProfile>(&content) {
                        profiles.push(profile);
                    }
                }
            }
        }
    }

    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    profiles
}

/// Save a profile as a TOML file in the profiles directory.
pub fn save_profile(config_dir: &Path, profile: &SmtpProfile) -> Result<()> {
    let profiles_dir = config_dir.join("profiles");
    std::fs::create_dir_all(&profiles_dir)?;

    let filename = sanitize_filename(&profile.name);
    let path = profiles_dir.join(format!("{filename}.toml"));

    let content = toml::to_string_pretty(profile)
        .map_err(|e| SmtpLabError::Profile(format!("Failed to serialize profile: {e}")))?;
    std::fs::write(&path, content)?;
    Ok(())
}

/// Load a single profile by name.
pub fn load_profile(config_dir: &Path, name: &str) -> Option<SmtpProfile> {
    let filename = sanitize_filename(name);
    let path = config_dir.join("profiles").join(format!("{filename}.toml"));
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    toml::from_str::<SmtpProfile>(&content).ok()
}

/// Delete a profile by name.
pub fn delete_profile(config_dir: &Path, name: &str) -> Result<()> {
    let filename = sanitize_filename(name);
    let path = config_dir.join("profiles").join(format!("{filename}.toml"));
    if !path.exists() {
        return Err(SmtpLabError::Profile(format!(
            "Profile '{name}' not found"
        )));
    }
    std::fs::remove_file(&path)?;
    Ok(())
}

/// Convert a profile name to a safe filename.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
