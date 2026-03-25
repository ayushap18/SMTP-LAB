use thiserror::Error;

/// Unified error type for all SMTP Lab operations.
#[derive(Debug, Error)]
pub enum SmtpLabError {
    #[error("Connection failed: {0}")]
    Connection(String),

    #[error("TLS error: {0}")]
    Tls(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Send failed: {0}")]
    Send(String),

    #[error("DNS lookup failed: {0}")]
    Dns(String),

    #[error("Timeout after {0} seconds")]
    Timeout(u64),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Profile error: {0}")]
    Profile(String),

    #[error("History error: {0}")]
    History(String),

    #[error("Batch error: {0}")]
    Batch(String),
}

impl SmtpLabError {
    /// Returns a human-friendly explanation of what likely went wrong.
    pub fn explanation(&self) -> &str {
        match self {
            Self::Connection(_) => {
                "Could not reach the SMTP server. Check the host, port, and firewall rules."
            }
            Self::Tls(_) => {
                "TLS negotiation failed. The server may not support the requested encryption, \
                 or the certificate may be invalid."
            }
            Self::Auth(_) => {
                "Authentication was rejected. Verify your username/password. \
                 If using Gmail/Outlook, you may need an app-specific password."
            }
            Self::Send(_) => {
                "The server accepted the connection but rejected the message. \
                 Check sender/recipient addresses and server relay policies."
            }
            Self::Dns(_) => {
                "DNS resolution failed. The domain may not exist or MX records may be misconfigured."
            }
            Self::Timeout(s) => {
                if *s <= 5 {
                    "The server did not respond quickly. It may be overloaded or unreachable."
                } else {
                    "The operation timed out. The server may be down or a firewall is blocking traffic."
                }
            }
            Self::Config(_) => "The provided configuration is invalid. Check all required fields.",
            Self::Io(_) => "A low-level I/O error occurred. Check network connectivity.",
            Self::Profile(_) => "A profile operation failed. Check the profile name and config directory.",
            Self::History(_) => "A history operation failed. Check the history directory.",
            Self::Batch(_) => "A batch operation failed. Check the batch configuration.",
        }
    }
}

/// Convenience alias used throughout the crate.
pub type Result<T> = std::result::Result<T, SmtpLabError>;
