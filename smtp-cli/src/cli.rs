//! CLI argument definitions using clap derive macros.

use clap::{Parser, Subcommand};

/// SMTP Lab -- CLI tool for testing SMTP servers.
#[derive(Parser, Debug)]
#[command(
    name = "smtp-test",
    version,
    about = "Test SMTP server connectivity, authentication, and delivery",
    long_about = "SMTP Lab is a professional CLI tool for testing SMTP servers.\n\
                  It supports sending test emails, running diagnostics, batch testing,\n\
                  managing connection profiles, and viewing test history."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Send a test email
    Send(SendArgs),

    /// Run diagnostics (DNS, STARTTLS, TLS cert, DKIM, SPF, DMARC)
    Diagnose(DiagnoseArgs),

    /// Test multiple servers from a TOML file
    Batch(BatchArgs),

    /// Manage saved connection profiles
    Profiles(ProfilesArgs),

    /// View past test results
    History(HistoryArgs),

    /// Show or edit configuration
    Config(ConfigArgs),
}

// ── send ─────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct SendArgs {
    /// SMTP server hostname
    #[arg(long)]
    pub host: Option<String>,

    /// SMTP server port
    #[arg(long)]
    pub port: Option<u16>,

    /// Encryption mode: none, ssl, starttls
    #[arg(long)]
    pub encryption: Option<String>,

    /// Username for SMTP authentication
    #[arg(long)]
    pub user: Option<String>,

    /// Password for SMTP authentication
    #[arg(long)]
    pub pass: Option<String>,

    /// Sender email address
    #[arg(long)]
    pub from: Option<String>,

    /// Recipient email address
    #[arg(long)]
    pub to: Option<String>,

    /// Email subject
    #[arg(long)]
    pub subject: Option<String>,

    /// Email body
    #[arg(long)]
    pub body: Option<String>,

    /// Send the body as HTML
    #[arg(long, default_value_t = false)]
    pub html: bool,

    /// Attach a file (can be repeated)
    #[arg(long = "attach", value_name = "FILE")]
    pub attachments: Vec<String>,

    /// Use a saved connection profile
    #[arg(long)]
    pub profile: Option<String>,

    /// Connection timeout in seconds
    #[arg(long)]
    pub timeout: Option<u64>,

    /// Number of retries on failure
    #[arg(long)]
    pub retries: Option<u32>,

    /// Output as JSON
    #[arg(long, default_value_t = false)]
    pub json: bool,

    /// Save result to history (default: true)
    #[arg(long)]
    pub save_history: Option<bool>,
}

// ── diagnose ─────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct DiagnoseArgs {
    /// SMTP server hostname
    #[arg(long)]
    pub host: Option<String>,

    /// SMTP server port
    #[arg(long)]
    pub port: Option<u16>,

    /// Sender email address (for SPF checks)
    #[arg(long)]
    pub from: Option<String>,

    /// Recipient email address (for MX checks)
    #[arg(long)]
    pub to: Option<String>,

    /// DKIM selector (default: "google")
    #[arg(long)]
    pub dkim_selector: Option<String>,

    /// Output as JSON
    #[arg(long, default_value_t = false)]
    pub json: bool,

    /// Use a saved connection profile
    #[arg(long)]
    pub profile: Option<String>,
}

// ── batch ────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct BatchArgs {
    /// Path to the batch TOML config file
    #[arg(long)]
    pub file: String,

    /// Run tests in parallel
    #[arg(long, default_value_t = false)]
    pub parallel: bool,

    /// Output as JSON
    #[arg(long, default_value_t = false)]
    pub json: bool,
}

// ── profiles ─────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct ProfilesArgs {
    #[command(subcommand)]
    pub command: ProfilesCommand,
}

#[derive(Subcommand, Debug)]
pub enum ProfilesCommand {
    /// List all saved profiles
    List,

    /// Interactively add a new profile
    Add,

    /// Remove a profile by name
    Remove {
        /// Profile name to remove
        name: String,
    },

    /// Show details of a profile
    Show {
        /// Profile name to show
        name: String,
    },
}

// ── history ──────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct HistoryArgs {
    #[command(subcommand)]
    pub command: HistoryCommand,
}

#[derive(Subcommand, Debug)]
pub enum HistoryCommand {
    /// List recent test results
    List {
        /// Maximum number of entries to show
        #[arg(long)]
        limit: Option<usize>,
    },

    /// Show details of a specific test result
    Show {
        /// History entry ID (or prefix)
        id: String,
    },

    /// Clear all history
    Clear,
}

// ── config ───────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
pub struct ConfigArgs {
    #[command(subcommand)]
    pub command: ConfigCommand,
}

#[derive(Subcommand, Debug)]
pub enum ConfigCommand {
    /// Show the current configuration
    Show,

    /// Create a default .smtplab.toml template
    Init,
}
