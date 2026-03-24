use serde::{Deserialize, Serialize};

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
    pub fn validate(&self) -> crate::error::Result<()> {
        if self.host.is_empty() {
            return Err(crate::error::SmtpLabError::Config(
                "Host is required".into(),
            ));
        }
        if self.from.is_empty() {
            return Err(crate::error::SmtpLabError::Config(
                "From address is required".into(),
            ));
        }
        if self.to.is_empty() {
            return Err(crate::error::SmtpLabError::Config(
                "To address is required".into(),
            ));
        }
        Ok(())
    }
}
