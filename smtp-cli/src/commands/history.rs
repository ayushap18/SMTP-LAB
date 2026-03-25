//! The `history` subcommand: view past test results.

use crate::config_file;
use crate::output;
use colored::Colorize;
use comfy_table::{presets::UTF8_FULL, Cell, CellAlignment, Color, Table};

/// Execute the `history` subcommand.
pub fn execute(args: &crate::cli::HistoryArgs) {
    match &args.command {
        crate::cli::HistoryCommand::List { limit } => list_history(*limit),
        crate::cli::HistoryCommand::Show { id } => show_history(id),
        crate::cli::HistoryCommand::Clear => clear_history(),
    }
}

fn list_history(limit: Option<usize>) {
    let config = config_file::load_config();

    if config.history.is_empty() {
        output::print_info("No history entries found.");
        return;
    }

    let limit = limit.unwrap_or(config.history.len());
    let entries: Vec<_> = config.history.iter().rev().take(limit).collect();

    let mut table = Table::new();
    table.load_preset(UTF8_FULL);
    table.set_header(vec![
        Cell::new("ID").set_alignment(CellAlignment::Left),
        Cell::new("Timestamp").set_alignment(CellAlignment::Left),
        Cell::new("Host").set_alignment(CellAlignment::Left),
        Cell::new("Port").set_alignment(CellAlignment::Right),
        Cell::new("Status").set_alignment(CellAlignment::Center),
        Cell::new("Latency").set_alignment(CellAlignment::Right),
    ]);

    for entry in &entries {
        let short_id = if entry.id.len() > 8 {
            &entry.id[..8]
        } else {
            &entry.id
        };

        let status_cell = if entry.success {
            Cell::new("OK").fg(Color::Green)
        } else {
            Cell::new("FAIL").fg(Color::Red)
        };

        table.add_row(vec![
            Cell::new(short_id),
            Cell::new(&entry.timestamp),
            Cell::new(&entry.host),
            Cell::new(entry.port),
            status_cell,
            Cell::new(format!("{}ms", entry.elapsed_ms)),
        ]);
    }

    println!("{table}");
    println!(
        "{}",
        format!("Showing {} of {} entries", entries.len(), config.history.len()).dimmed()
    );
}

fn show_history(id: &str) {
    let config = config_file::load_config();

    let entry = config
        .history
        .iter()
        .find(|e| e.id.starts_with(id));

    match entry {
        Some(e) => {
            println!("{}: {}", "ID".bold(), e.id);
            println!("{}: {}", "Timestamp".bold(), e.timestamp);
            println!("{}: {}", "Host".bold(), e.host);
            println!("{}: {}", "Port".bold(), e.port);
            println!(
                "{}: {}",
                "Status".bold(),
                if e.success {
                    "OK".green().to_string()
                } else {
                    "FAIL".red().to_string()
                }
            );
            println!("{}: {}", "Message".bold(), e.message);
            println!("{}: {}ms", "Latency".bold(), e.elapsed_ms);
        }
        None => {
            output::print_error(&format!("History entry '{}' not found", id));
            std::process::exit(1);
        }
    }
}

fn clear_history() {
    let mut config = config_file::load_config();
    match config_file::clear_history(&mut config) {
        Ok(()) => {
            output::print_success("History cleared");
        }
        Err(e) => {
            output::print_error(&format!("Failed to clear history: {}", e));
            std::process::exit(1);
        }
    }
}
