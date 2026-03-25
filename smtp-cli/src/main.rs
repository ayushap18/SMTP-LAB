mod cli;
mod commands;
mod config_file;
mod output;
mod types;

use clap::Parser;
use cli::{Cli, Command};

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Determine if we should suppress the banner (JSON output modes).
    let json_mode = match &cli.command {
        Command::Send(args) => args.json,
        Command::Diagnose(args) => args.json,
        Command::Batch(args) => args.json,
        _ => false,
    };

    if !json_mode {
        output::print_banner();
    }

    match cli.command {
        Command::Send(ref args) => commands::send::execute(args).await,
        Command::Diagnose(ref args) => commands::diagnose::execute(args).await,
        Command::Batch(ref args) => commands::batch::execute(args).await,
        Command::Profiles(ref args) => commands::profiles::execute(args),
        Command::History(ref args) => commands::history::execute(args),
        Command::Config(ref args) => commands::config::execute(args),
    }
}
