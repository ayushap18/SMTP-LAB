use clap::Parser;
use colored::Colorize;
use smtp_core::{Encryption, LogEntry, LogLevel, SmtpConfig, SmtpLogger, SmtpTester};

/// SMTP Lab — CLI tool for testing SMTP servers.
#[derive(Parser, Debug)]
#[command(name = "smtp-test", version, about = "Test SMTP server connectivity, auth, and delivery")]
struct Args {
    /// SMTP server hostname
    #[arg(long)]
    host: String,

    /// SMTP server port
    #[arg(long, default_value_t = 587)]
    port: u16,

    /// Encryption mode: none, ssl, starttls
    #[arg(long, default_value = "starttls")]
    encryption: String,

    /// Username for SMTP authentication
    #[arg(long, default_value = "")]
    user: String,

    /// Password for SMTP authentication (use app passwords when possible)
    #[arg(long, default_value = "")]
    pass: String,

    /// Sender email address
    #[arg(long)]
    from: String,

    /// Recipient email address
    #[arg(long)]
    to: String,

    /// Email subject
    #[arg(long, default_value = "SMTP Lab Test Email")]
    subject: String,

    /// Email body
    #[arg(long, default_value = "This is a test email sent by SMTP Lab.")]
    body: String,

    /// Connection timeout in seconds
    #[arg(long, default_value_t = 30)]
    timeout: u64,

    /// Run diagnostics only (DNS, STARTTLS, TLS cert) without sending
    #[arg(long, default_value_t = false)]
    diagnose: bool,

    /// Output as JSON instead of colored text
    #[arg(long, default_value_t = false)]
    json: bool,
}

fn parse_encryption(s: &str) -> Encryption {
    match s.to_lowercase().as_str() {
        "ssl" | "tls" => Encryption::Ssl,
        "starttls" => Encryption::StartTls,
        "none" | "plain" => Encryption::None,
        _ => {
            eprintln!(
                "{} Unknown encryption '{}', defaulting to STARTTLS",
                "WARN".yellow().bold(),
                s
            );
            Encryption::StartTls
        }
    }
}

fn print_log_entry(entry: &LogEntry) {
    let level_str = match entry.level {
        LogLevel::Info => format!("[{}]", entry.level).cyan(),
        LogLevel::Success => format!("[{}]", entry.level).green(),
        LogLevel::Warning => format!("[{}]", entry.level).yellow(),
        LogLevel::Error => format!("[{}]", entry.level).red(),
        LogLevel::Debug => format!("[{}]", entry.level).dimmed(),
    };

    let code_str = match entry.smtp_code {
        Some(c) => format!(" {}", c.to_string().bold()),
        None => String::new(),
    };

    println!(
        "{} {} {}{} {}",
        entry.timestamp.dimmed(),
        level_str,
        entry.stage.bold(),
        code_str,
        entry.message
    );
}

fn print_banner() {
    println!();
    println!("{}", "╔══════════════════════════════════════╗".cyan());
    println!("{}", "║          SMTP Lab  v0.1.0            ║".cyan());
    println!("{}", "║      SMTP Testing & Diagnostics      ║".cyan());
    println!("{}", "╚══════════════════════════════════════╝".cyan());
    println!();
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    if !args.json {
        print_banner();
    }

    let config = SmtpConfig {
        host: args.host,
        port: args.port,
        encryption: parse_encryption(&args.encryption),
        username: args.user,
        password: args.pass,
        from: args.from,
        to: args.to,
        subject: args.subject,
        body: args.body,
        timeout_secs: args.timeout,
        auth_method: None,
    };

    let logger = SmtpLogger::new();

    // Set up real-time log printing (unless JSON mode)
    if !args.json {
        logger.on_entry(|entry| {
            print_log_entry(&entry);
        });
    }

    let tester = SmtpTester::new(config, logger);

    if args.diagnose {
        if !args.json {
            println!("{}", "Running diagnostics only…".dimmed());
            println!();
        }
        let diag = tester.diagnose().await;
        if args.json {
            println!("{}", serde_json::to_string_pretty(&diag).unwrap());
        } else {
            // Logs were already printed via callback
            println!();
            println!("{}", "Diagnostics complete.".bold());
        }
        return;
    }

    let result = tester.run().await;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
    } else {
        println!();
        if result.success {
            println!(
                "{}  {}",
                "✓".green().bold(),
                result.message.green().bold()
            );
        } else {
            println!(
                "{}  {}",
                "✗".red().bold(),
                result.message.red().bold()
            );
        }
        println!(
            "{}",
            format!("   Completed in {}ms", result.elapsed_ms).dimmed()
        );
        println!();
    }

    if !result.success {
        std::process::exit(1);
    }
}
