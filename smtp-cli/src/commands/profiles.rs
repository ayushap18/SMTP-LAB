//! The `profiles` subcommand: manage saved connection profiles.

use crate::config_file;
use crate::output;
use crate::types::Profile;
use colored::Colorize;
use comfy_table::{presets::UTF8_FULL, Cell, CellAlignment, Table};
use dialoguer::{Input, Select};

/// Execute the `profiles` subcommand.
pub fn execute(args: &crate::cli::ProfilesArgs) {
    match &args.command {
        crate::cli::ProfilesCommand::List => list_profiles(),
        crate::cli::ProfilesCommand::Add => add_profile(),
        crate::cli::ProfilesCommand::Remove { name } => remove_profile(name),
        crate::cli::ProfilesCommand::Show { name } => show_profile(name),
    }
}

fn list_profiles() {
    let config = config_file::load_config();

    if config.profiles.is_empty() {
        output::print_info("No profiles saved. Use 'smtp-test profiles add' to create one.");
        return;
    }

    let mut table = Table::new();
    table.load_preset(UTF8_FULL);
    table.set_header(vec![
        Cell::new("Name").set_alignment(CellAlignment::Left),
        Cell::new("Host").set_alignment(CellAlignment::Left),
        Cell::new("Port").set_alignment(CellAlignment::Right),
        Cell::new("Encryption").set_alignment(CellAlignment::Center),
        Cell::new("From").set_alignment(CellAlignment::Left),
    ]);

    for p in &config.profiles {
        table.add_row(vec![
            Cell::new(&p.name),
            Cell::new(&p.host),
            Cell::new(p.port),
            Cell::new(&p.encryption),
            Cell::new(&p.from),
        ]);
    }

    println!("{table}");
}

fn add_profile() {
    output::print_section("Add New Profile");

    let name: String = Input::new()
        .with_prompt("Profile name")
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let host: String = Input::new()
        .with_prompt("SMTP host")
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let port: u16 = Input::new()
        .with_prompt("Port")
        .default(587)
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let encryption_options = &["starttls", "ssl", "none"];
    let encryption_idx = Select::new()
        .with_prompt("Encryption")
        .items(encryption_options)
        .default(0)
        .interact()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });
    let encryption = encryption_options[encryption_idx].to_string();

    let username: String = Input::new()
        .with_prompt("Username (leave empty to skip auth)")
        .default(String::new())
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let password: String = Input::new()
        .with_prompt("Password (leave empty to skip)")
        .default(String::new())
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let from: String = Input::new()
        .with_prompt("From address")
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let to: String = Input::new()
        .with_prompt("To address")
        .interact_text()
        .unwrap_or_else(|_| {
            output::print_error("Failed to read input");
            std::process::exit(1);
        });

    let profile = Profile {
        name: name.clone(),
        host,
        port,
        encryption,
        username,
        password,
        from,
        to,
    };

    let mut config = config_file::load_config();
    match config_file::add_profile(&mut config, profile) {
        Ok(()) => {
            output::print_success(&format!("Profile '{}' saved", name));
        }
        Err(e) => {
            output::print_error(&format!("Failed to save profile: {}", e));
            std::process::exit(1);
        }
    }
}

fn remove_profile(name: &str) {
    let mut config = config_file::load_config();
    match config_file::remove_profile(&mut config, name) {
        Ok(true) => {
            output::print_success(&format!("Profile '{}' removed", name));
        }
        Ok(false) => {
            output::print_error(&format!("Profile '{}' not found", name));
            std::process::exit(1);
        }
        Err(e) => {
            output::print_error(&format!("Failed to remove profile: {}", e));
            std::process::exit(1);
        }
    }
}

fn show_profile(name: &str) {
    let config = config_file::load_config();
    match config_file::find_profile(&config, name) {
        Some(p) => {
            println!("{}: {}", "Name".bold(), p.name);
            println!("{}: {}", "Host".bold(), p.host);
            println!("{}: {}", "Port".bold(), p.port);
            println!("{}: {}", "Encryption".bold(), p.encryption);
            println!("{}: {}", "Username".bold(), if p.username.is_empty() { "(none)" } else { &p.username });
            println!("{}: {}", "Password".bold(), if p.password.is_empty() { "(none)" } else { "********" });
            println!("{}: {}", "From".bold(), p.from);
            println!("{}: {}", "To".bold(), p.to);
        }
        None => {
            output::print_error(&format!("Profile '{}' not found", name));
            std::process::exit(1);
        }
    }
}
