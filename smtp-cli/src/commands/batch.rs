//! The `batch` subcommand: test multiple servers from a TOML file.

use crate::commands::send::parse_encryption;
use crate::output;
use crate::types::BatchConfig;
use colored::Colorize;
use comfy_table::{presets::UTF8_FULL, Cell, CellAlignment, Color, Table};
use smtp_core::{SmtpConfig, SmtpLogger, SmtpTester};

/// Execute the `batch` subcommand.
pub async fn execute(args: &crate::cli::BatchArgs) {
    let file_path = &args.file;

    let contents = match std::fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => {
            output::print_error(&format!("Failed to read batch file '{}': {}", file_path, e));
            std::process::exit(1);
        }
    };

    let batch_config: BatchConfig = match toml::from_str(&contents) {
        Ok(c) => c,
        Err(e) => {
            output::print_error(&format!("Failed to parse batch file: {}", e));
            std::process::exit(1);
        }
    };

    if batch_config.targets.is_empty() {
        output::print_warning("No targets defined in batch file");
        return;
    }

    if !args.json {
        println!(
            "{}",
            format!("Running batch test against {} targets...", batch_config.targets.len())
                .blue()
                .bold()
        );
        println!();
    }

    struct BatchResult {
        host: String,
        port: u16,
        success: bool,
        elapsed_ms: u64,
        message: String,
    }

    let mut results: Vec<BatchResult> = Vec::new();

    if args.parallel {
        // Run all targets in parallel
        let mut handles = Vec::new();
        for target in &batch_config.targets {
            let config = SmtpConfig {
                host: target.host.clone(),
                port: target.port,
                encryption: parse_encryption(&target.encryption),
                username: target.username.clone(),
                password: target.password.clone(),
                from: target.from.clone(),
                to: target.to.clone(),
                subject: target.subject.clone(),
                body: target.body.clone(),
                html_body: None,
                attachments: Vec::new(),
                timeout_secs: 30,
                auth_method: None,
            };
            let host = target.host.clone();
            let port = target.port;

            let handle = tokio::spawn(async move {
                let logger = SmtpLogger::new();
                let tester = SmtpTester::new(config, logger);
                let result = tester.run().await;
                BatchResult {
                    host,
                    port,
                    success: result.success,
                    elapsed_ms: result.elapsed_ms,
                    message: result.message,
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            match handle.await {
                Ok(r) => results.push(r),
                Err(e) => {
                    output::print_error(&format!("Task failed: {}", e));
                }
            }
        }
    } else {
        // Run sequentially
        for (i, target) in batch_config.targets.iter().enumerate() {
            if !args.json {
                println!(
                    "{}",
                    format!(
                        "[{}/{}] Testing {}:{}...",
                        i + 1,
                        batch_config.targets.len(),
                        target.host,
                        target.port
                    )
                    .dimmed()
                );
            }

            let config = SmtpConfig {
                host: target.host.clone(),
                port: target.port,
                encryption: parse_encryption(&target.encryption),
                username: target.username.clone(),
                password: target.password.clone(),
                from: target.from.clone(),
                to: target.to.clone(),
                subject: target.subject.clone(),
                body: target.body.clone(),
                html_body: None,
                attachments: Vec::new(),
                timeout_secs: 30,
                auth_method: None,
            };

            let logger = SmtpLogger::new();
            let tester = SmtpTester::new(config, logger);
            let result = tester.run().await;

            results.push(BatchResult {
                host: target.host.clone(),
                port: target.port,
                success: result.success,
                elapsed_ms: result.elapsed_ms,
                message: result.message,
            });
        }
    }

    // Output
    if args.json {
        let json_results: Vec<serde_json::Value> = results
            .iter()
            .map(|r| {
                serde_json::json!({
                    "host": r.host,
                    "port": r.port,
                    "success": r.success,
                    "elapsed_ms": r.elapsed_ms,
                    "message": r.message,
                })
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&json_results).unwrap());
    } else {
        // Summary table
        println!();
        output::print_section("Batch Results");

        let mut table = Table::new();
        table.load_preset(UTF8_FULL);
        table.set_header(vec![
            Cell::new("Host").set_alignment(CellAlignment::Left),
            Cell::new("Port").set_alignment(CellAlignment::Right),
            Cell::new("Status").set_alignment(CellAlignment::Center),
            Cell::new("Latency").set_alignment(CellAlignment::Right),
        ]);

        let mut all_ok = true;
        for r in &results {
            let status_cell = if r.success {
                Cell::new("OK").fg(Color::Green)
            } else {
                all_ok = false;
                Cell::new("FAIL").fg(Color::Red)
            };
            table.add_row(vec![
                Cell::new(&r.host),
                Cell::new(r.port),
                status_cell,
                Cell::new(format!("{}ms", r.elapsed_ms)),
            ]);
        }

        println!("{table}");

        let passed = results.iter().filter(|r| r.success).count();
        let total = results.len();
        println!();
        if all_ok {
            output::print_success(&format!("All {total} targets passed"));
        } else {
            output::print_failure(&format!("{passed}/{total} targets passed"));
        }
    }

    let any_failed = results.iter().any(|r| !r.success);
    if any_failed {
        std::process::exit(1);
    }
}
