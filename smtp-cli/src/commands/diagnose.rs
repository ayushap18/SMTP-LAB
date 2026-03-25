//! The `diagnose` subcommand: run DNS, STARTTLS, TLS cert, DKIM, SPF, DMARC checks.

use crate::config_file;
use crate::output;
use smtp_core::{SmtpConfig, SmtpLogger, SmtpTester};

/// Execute the `diagnose` subcommand.
pub async fn execute(args: &crate::cli::DiagnoseArgs) {
    let app_config = config_file::load_config();

    let profile = args.profile.as_ref().and_then(|name| {
        let p = config_file::find_profile(&app_config, name);
        if p.is_none() {
            output::print_error(&format!("Profile '{}' not found", name));
        }
        p
    });

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

    if host.is_empty() {
        output::print_error("--host is required for diagnostics");
        std::process::exit(1);
    }

    let _dkim_selector = args
        .dkim_selector
        .clone()
        .unwrap_or_else(|| defaults.dkim_selector.clone());

    // Build a minimal config for the tester
    let config = SmtpConfig {
        host,
        port,
        encryption: crate::commands::send::parse_encryption(&defaults.encryption),
        username: String::new(),
        password: String::new(),
        from,
        to,
        subject: String::new(),
        body: String::new(),
        html_body: None,
        attachments: Vec::new(),
        timeout_secs: defaults.timeout,
        auth_method: None,
    };

    let logger = SmtpLogger::new();

    if !args.json {
        logger.on_entry(|entry| {
            output::print_log_entry(&entry);
        });
        println!("{}", colored::Colorize::dimmed("Running diagnostics..."));
        println!();
    }

    let tester = SmtpTester::new(config, logger);
    let diag = tester.diagnose().await;

    if args.json {
        println!("{}", serde_json::to_string_pretty(&diag).unwrap());
    } else {
        println!();
        println!("{}", colored::Colorize::bold("Diagnostics complete."));
    }
}
