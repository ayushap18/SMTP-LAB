//! The `send` subcommand: send a test email.

use crate::config_file;
use crate::output;
use crate::types::HistoryEntry;
use colored::Colorize;
use smtp_core::{Encryption, SmtpConfig, SmtpLogger, SmtpTester};

/// Execute the `send` subcommand.
pub async fn execute(args: &crate::cli::SendArgs) {
    let app_config = config_file::load_config();

    // Resolve profile if specified
    let profile = args.profile.as_ref().and_then(|name| {
        let p = config_file::find_profile(&app_config, name);
        if p.is_none() {
            output::print_error(&format!("Profile '{}' not found", name));
        }
        p
    });

    // Determine values: flag > profile > config defaults > hardcoded
    let defaults = &app_config.defaults;
    let host = args
        .host
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.host.clone()))
        .unwrap_or_else(|| defaults.host.clone());
    let port = args
        .port
        .or_else(|| profile.as_ref().map(|p| p.port))
        .unwrap_or(defaults.port);
    let encryption_str = args
        .encryption
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.encryption.clone()))
        .unwrap_or_else(|| defaults.encryption.clone());
    let username = args
        .user
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.username.clone()))
        .unwrap_or_default();
    let password = args
        .pass
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.password.clone()))
        .unwrap_or_default();
    let from = args
        .from
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.from.clone()))
        .unwrap_or_else(|| defaults.from.clone());
    let to = args
        .to
        .clone()
        .or_else(|| profile.as_ref().map(|p| p.to.clone()))
        .unwrap_or_else(|| defaults.to.clone());
    let subject = args
        .subject
        .clone()
        .unwrap_or_else(|| defaults.subject.clone());
    let body = args
        .body
        .clone()
        .unwrap_or_else(|| defaults.body.clone());
    let timeout = args.timeout.unwrap_or(defaults.timeout);

    if host.is_empty() {
        output::print_error("--host is required (or set it in a profile / config file)");
        std::process::exit(1);
    }
    if from.is_empty() {
        output::print_error("--from is required (or set it in a profile / config file)");
        std::process::exit(1);
    }
    if to.is_empty() {
        output::print_error("--to is required (or set it in a profile / config file)");
        std::process::exit(1);
    }

    let encryption = parse_encryption(&encryption_str);

    let html_body = if args.html { Some(body.clone()) } else { None };

    let config = SmtpConfig {
        host: host.clone(),
        port,
        encryption,
        username,
        password,
        from,
        to,
        subject,
        body,
        html_body,
        attachments: args.attachments.clone(),
        timeout_secs: timeout,
        auth_method: None,
    };

    let logger = SmtpLogger::new();

    if !args.json {
        logger.on_entry(|entry| {
            output::print_log_entry(&entry);
        });
    }

    let tester = SmtpTester::new(config, logger);

    // Retry logic
    let retries = args.retries.unwrap_or(0);
    let mut result = tester.run().await;
    for attempt in 1..=retries {
        if result.success {
            break;
        }
        if !args.json {
            println!(
                "{}",
                format!("   Retry {}/{}...", attempt, retries).yellow()
            );
        }
        result = tester.run().await;
    }

    if args.json {
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
    } else {
        if result.success {
            output::print_success(&result.message);
        } else {
            output::print_failure(&result.message);
        }
        output::print_elapsed(result.elapsed_ms);
    }

    // Save to history (default: true)
    if args.save_history.unwrap_or(true) {
        let entry = HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            host: host.clone(),
            port,
            success: result.success,
            message: result.message.clone(),
            elapsed_ms: result.elapsed_ms,
        };
        let mut cfg = config_file::load_config();
        let _ = config_file::add_history_entry(&mut cfg, entry);
    }

    if !result.success {
        std::process::exit(1);
    }
}

pub fn parse_encryption(s: &str) -> Encryption {
    match s.to_lowercase().as_str() {
        "ssl" | "tls" => Encryption::Ssl,
        "starttls" => Encryption::StartTls,
        "none" | "plain" => Encryption::None,
        _ => {
            output::print_warning(&format!(
                "Unknown encryption '{}', defaulting to STARTTLS",
                s
            ));
            Encryption::StartTls
        }
    }
}
