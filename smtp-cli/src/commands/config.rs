//! The `config` subcommand: show/edit configuration.

use crate::config_file;
use crate::output;
use colored::Colorize;

/// Execute the `config` subcommand.
pub fn execute(args: &crate::cli::ConfigArgs) {
    match &args.command {
        crate::cli::ConfigCommand::Show => show_config(),
        crate::cli::ConfigCommand::Init => init_config(),
    }
}

fn show_config() {
    match config_file::find_config_file() {
        Some(path) => {
            println!("{}: {}", "Config file".bold(), path.display());
            println!();

            match std::fs::read_to_string(&path) {
                Ok(contents) => {
                    println!("{}", contents);
                }
                Err(e) => {
                    output::print_error(&format!("Failed to read config: {}", e));
                    std::process::exit(1);
                }
            }
        }
        None => {
            output::print_info(
                "No .smtplab.toml found. Use 'smtp-test config init' to create one.",
            );
        }
    }
}

fn init_config() {
    if let Some(existing) = config_file::find_config_file() {
        output::print_warning(&format!(
            "Config file already exists at: {}",
            existing.display()
        ));
        output::print_info("Delete it first if you want to create a fresh template.");
        return;
    }

    match config_file::create_template() {
        Ok(path) => {
            output::print_success(&format!("Created config template at {}", path.display()));
        }
        Err(e) => {
            output::print_error(&format!("Failed to create config: {}", e));
            std::process::exit(1);
        }
    }
}
