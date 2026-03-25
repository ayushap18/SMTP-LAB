//! Output formatting: banner, log printing, tables, colors.

use colored::Colorize;
use smtp_core::{LogEntry, LogLevel};

/// Print the startup banner (skipped in --json mode).
pub fn print_banner() {
    println!();
    println!(
        "{}",
        "\u{2554}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2557}"
            .cyan()
    );
    println!(
        "{}",
        "\u{2551}          SMTP Lab  v0.1.0            \u{2551}".cyan()
    );
    println!(
        "{}",
        "\u{2551}      SMTP Testing & Diagnostics       \u{2551}".cyan()
    );
    println!(
        "{}",
        "\u{255a}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{255d}"
            .cyan()
    );
    println!();
}

/// Print a single log entry with color-coded level.
pub fn print_log_entry(entry: &LogEntry) {
    let level_str = match entry.level {
        LogLevel::Info => format!("[{}]", entry.level).blue(),
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

/// Print a success result line.
pub fn print_success(message: &str) {
    println!();
    println!(
        "{}  {}",
        "\u{2713}".green().bold(),
        message.green().bold()
    );
}

/// Print a failure result line.
pub fn print_failure(message: &str) {
    println!();
    println!(
        "{}  {}",
        "\u{2717}".red().bold(),
        message.red().bold()
    );
}

/// Print elapsed time.
pub fn print_elapsed(elapsed_ms: u64) {
    println!(
        "{}",
        format!("   Completed in {}ms", elapsed_ms).dimmed()
    );
    println!();
}

/// Print a section header.
pub fn print_section(title: &str) {
    println!();
    println!("{}", title.bold().underline());
    println!();
}

/// Print a warning message.
pub fn print_warning(message: &str) {
    eprintln!(
        "{} {}",
        "WARN".yellow().bold(),
        message
    );
}

/// Print an error message.
pub fn print_error(message: &str) {
    eprintln!(
        "{} {}",
        "ERROR".red().bold(),
        message
    );
}

/// Print an info message.
pub fn print_info(message: &str) {
    println!(
        "{} {}",
        "INFO".blue().bold(),
        message
    );
}
