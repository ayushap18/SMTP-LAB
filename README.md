# SMTP Lab

A high-performance, cross-platform SMTP testing and diagnostics toolkit built in Rust.

Test SMTP server connectivity, authenticate with PLAIN/LOGIN, send test emails, debug delivery issues, and view detailed step-by-step SMTP handshake logs.

![Rust](https://img.shields.io/badge/Built%20with-Rust-orange?style=flat-square&logo=rust)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-green?style=flat-square)

---

## Features

- **SMTP Connection Testing** — Connect to any SMTP server with configurable host, port, encryption
- **Authentication** — PLAIN and LOGIN mechanisms with secure credential handling
- **Email Sending** — Send test emails with custom sender, recipient, subject, and body
- **Real-time Debug Logs** — Raw SMTP response codes (220, 250, 535, etc.), TLS negotiation, auth results
- **DNS Diagnostics** — MX record lookup for any domain
- **STARTTLS Detection** — Automatically checks if server supports STARTTLS upgrade
- **TLS Certificate Validation** — Validates server certificates on SSL connections
- **Timeout Handling** — Configurable connection timeouts with clear error reporting
- **Password Security** — Credentials are never logged in plain text
- **Multiple Interfaces** — Desktop app, CLI tool, and VS Code extension

---

## Architecture

```
SMTP-LAB/
├── smtp-core/              # Shared Rust library (SMTP client, TLS, DNS, logging)
├── smtp-cli/               # CLI binary (smtp-test)
├── desktop-app/            # Tauri desktop application
│   ├── src-tauri/          #   Rust backend (bridges to smtp-core)
│   └── src/                #   Frontend (HTML/CSS/JS)
└── vscode-extension/       # VS Code extension (bridges to smtp-test CLI)
```

All SMTP logic lives in `smtp-core`. Every other component is a thin wrapper around it.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Core Logic | Rust (lettre, tokio, native-tls, rustls, trust-dns) |
| Desktop App | Tauri v2 + HTML/CSS/JS |
| CLI | Rust (clap, colored) |
| VS Code Extension | TypeScript + smtp-test binary bridge |

---

## Prerequisites

- [Rust](https://rustup.rs/) (stable 1.75+)
- For desktop app: Tauri v2 prerequisites ([platform guide](https://v2.tauri.app/start/prerequisites/))
- For VS Code extension: Node.js 18+

---

## Build

### Core Library + CLI

```bash
cargo build --release
```

The `smtp-test` binary will be at `target/release/smtp-test`.

### Desktop App

```bash
cargo install tauri-cli --version "^2"
cd desktop-app
cargo tauri build
```

The bundled application will be in `desktop-app/src-tauri/target/release/bundle/`.

### VS Code Extension

```bash
cd vscode-extension
npm install
npm run compile
```

To package and install:

```bash
npm install -g @vscode/vsce
cd vscode-extension
vsce package
code --install-extension smtp-lab-0.1.0.vsix
```

---

## Usage

### CLI

```bash
# Full test with STARTTLS authentication
smtp-test --host smtp.gmail.com --port 587 --encryption starttls \
  --user you@gmail.com --pass "your-app-password" \
  --from you@gmail.com --to recipient@example.com

# SSL/TLS (port 465)
smtp-test --host smtp.gmail.com --port 465 --encryption ssl \
  --user you@gmail.com --pass "your-app-password" \
  --from you@gmail.com --to recipient@example.com

# Diagnostics only (DNS + STARTTLS + TLS cert check, no email sent)
smtp-test --host smtp.gmail.com --port 587 \
  --from you@gmail.com --to test@example.com --diagnose

# JSON output for scripting
smtp-test --host smtp.gmail.com --port 587 \
  --from you@gmail.com --to test@example.com --json

# Plain text (no encryption)
smtp-test --host mail.example.com --port 25 --encryption none \
  --from sender@example.com --to recipient@example.com
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | *(required)* | SMTP server hostname |
| `--port` | `587` | Server port |
| `--encryption` | `starttls` | `none`, `ssl`, or `starttls` |
| `--user` | *(empty)* | Auth username |
| `--pass` | *(empty)* | Auth password (never logged) |
| `--from` | *(required)* | Sender address |
| `--to` | *(required)* | Recipient address |
| `--subject` | `SMTP Lab Test Email` | Email subject |
| `--body` | `This is a test…` | Email body |
| `--timeout` | `30` | Timeout in seconds |
| `--diagnose` | `false` | Run diagnostics only |
| `--json` | `false` | JSON output |

### Desktop App

Launch the application. The interface has a split layout:

- **Left Panel** — Connection form (host, port, encryption, auth, message fields)
- **Right Panel** — Live terminal-style SMTP log viewer

Fill in the form and click **Send Test Email** or **Run Diagnostics**.

### VS Code Extension

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. **SMTP Lab: Open Testing Panel** — Full webview UI
3. **SMTP Lab: Quick Test** — Guided input flow in the terminal

Configure `smtpLab.binaryPath` in VS Code settings if `smtp-test` isn't in your PATH.

---

## Testing with Ethereal Email

[Ethereal Email](https://ethereal.email) provides free disposable SMTP accounts for testing:

```bash
# Generate credentials at https://ethereal.email/create
# Then test:
smtp-test --host smtp.ethereal.email --port 587 --encryption starttls \
  --user "generated@ethereal.email" --pass "generated-password" \
  --from "generated@ethereal.email" --to "test@example.com"
```

For local testing without internet, use [Mailpit](https://github.com/axllent/mailpit):

```bash
brew install mailpit && mailpit
smtp-test --host localhost --port 1025 --encryption none \
  --from sender@test.com --to recipient@test.com
```

---

## Example Output

```
╔══════════════════════════════════════╗
║          SMTP Lab  v0.1.0            ║
║      SMTP Testing & Diagnostics      ║
╚══════════════════════════════════════╝

19:41:17.552 [INFO] INIT    Starting SMTP test session
19:41:17.553 [INFO] INIT    Target: smtp.ethereal.email:587 (STARTTLS)
19:41:17.553 [ OK ] CONFIG  Configuration validated
19:41:17.553 [INFO] DNS     Looking up MX records for example.com
19:41:17.565 [ OK ] DNS     MX example.com → mail.example.com (priority 0)
19:41:18.459 [INFO] STARTTLS 220 smtp.ethereal.email ESMTP
19:41:18.651 [ OK ] STARTTLS Server advertises STARTTLS support
19:41:18.652 [INFO] CONNECT Building transport…
19:41:18.652 [INFO] TLS     Using STARTTLS upgrade
19:41:18.654 [INFO] AUTH    Authenticating as 'user@ethereal.email'
19:41:18.654 [DBG ] AUTH    Password: ******* (redacted)
19:41:22.462 [ OK ] CONNECT Connection established and verified
19:41:22.462 [INFO] MESSAGE Building email message…
19:41:22.463 [INFO] SEND    Sending email…
19:41:23.946 [INFO] SEND    250 Server response: Accepted
19:41:23.946 [ OK ] DONE    Email sent successfully to test@example.com

✓  Email sent successfully to test@example.com
   Completed in 6394ms
```

---

## Project Structure

| Crate | Type | Description |
|-------|------|-------------|
| `smtp-core` | Library | SMTP client, TLS validation, DNS lookup, logging, error handling |
| `smtp-cli` | Binary | CLI frontend with colored terminal output and JSON mode |
| `smtp-lab-desktop` | Binary | Tauri desktop app with split-pane UI |
| `vscode-extension` | Extension | VS Code integration via CLI bridge |

---

## License

MIT
