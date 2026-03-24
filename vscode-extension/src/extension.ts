import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("smtpLab.openPanel", () => {
      openPanel(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("smtpLab.quickTest", () => {
      quickTest();
    })
  );
}

function getBinaryPath(): string {
  const config = vscode.workspace.getConfiguration("smtpLab");
  const custom = config.get<string>("binaryPath", "");
  if (custom) {
    return custom;
  }
  // Fall back to PATH
  return "smtp-test";
}

function openPanel(context: vscode.ExtensionContext) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "smtpLab",
    "SMTP Lab",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent();

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "runTest":
          runSmtpTest(message.config, panel!);
          break;
        case "runDiagnostics":
          runDiagnostics(message.config, panel!);
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

function runSmtpTest(
  config: SmtpTestConfig,
  panel: vscode.WebviewPanel
) {
  const bin = getBinaryPath();
  const args = [
    "--host", config.host,
    "--port", String(config.port),
    "--encryption", config.encryption,
    "--from", config.from,
    "--to", config.to,
    "--subject", config.subject || "SMTP Lab Test",
    "--body", config.body || "Test email from SMTP Lab VS Code extension.",
    "--json",
  ];

  if (config.username) {
    args.push("--user", config.username);
  }
  if (config.password) {
    args.push("--pass", config.password);
  }

  panel.webview.postMessage({ command: "started" });

  const proc = cp.spawn(bin, args, { timeout: 60000 });
  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
  });

  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  proc.on("close", (code: number | null) => {
    try {
      const result = JSON.parse(stdout);
      panel.webview.postMessage({ command: "result", data: result });
    } catch {
      panel.webview.postMessage({
        command: "error",
        data: stderr || stdout || `Process exited with code ${code}`,
      });
    }
  });

  proc.on("error", (err: Error) => {
    panel.webview.postMessage({
      command: "error",
      data: `Failed to start smtp-test: ${err.message}. Make sure the binary is installed and in your PATH.`,
    });
  });
}

function runDiagnostics(
  config: { host: string; port: number; email: string },
  panel: vscode.WebviewPanel
) {
  const bin = getBinaryPath();
  const args = [
    "--host", config.host,
    "--port", String(config.port),
    "--from", config.email || "test@example.com",
    "--to", config.email || "test@example.com",
    "--diagnose",
    "--json",
  ];

  panel.webview.postMessage({ command: "started" });

  const proc = cp.spawn(bin, args, { timeout: 30000 });
  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
  });

  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  proc.on("close", () => {
    try {
      const result = JSON.parse(stdout);
      panel.webview.postMessage({ command: "diagResult", data: result });
    } catch {
      panel.webview.postMessage({
        command: "error",
        data: stderr || stdout || "Diagnostics failed",
      });
    }
  });

  proc.on("error", (err: Error) => {
    panel.webview.postMessage({
      command: "error",
      data: `Failed to start smtp-test: ${err.message}`,
    });
  });
}

async function quickTest() {
  const host = await vscode.window.showInputBox({
    prompt: "SMTP Host",
    placeHolder: "smtp.gmail.com",
    value: vscode.workspace
      .getConfiguration("smtpLab")
      .get<string>("defaultHost", ""),
  });
  if (!host) {
    return;
  }

  const from = await vscode.window.showInputBox({
    prompt: "From email address",
    placeHolder: "sender@example.com",
  });
  if (!from) {
    return;
  }

  const to = await vscode.window.showInputBox({
    prompt: "To email address",
    placeHolder: "recipient@example.com",
  });
  if (!to) {
    return;
  }

  const bin = getBinaryPath();
  const config = vscode.workspace.getConfiguration("smtpLab");
  const port = config.get<number>("defaultPort", 587);
  const encryption = config.get<string>("defaultEncryption", "starttls");

  const terminal = vscode.window.createTerminal("SMTP Lab");
  terminal.show();
  terminal.sendText(
    `${bin} --host ${host} --port ${port} --encryption ${encryption} --from ${from} --to ${to}`
  );
}

interface SmtpTestConfig {
  host: string;
  port: number;
  encryption: string;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export function deactivate() {
  panel?.dispose();
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SMTP Lab</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --input-bg: var(--vscode-input-background);
    --input-border: var(--vscode-input-border);
    --input-fg: var(--vscode-input-foreground);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --success: #4ade80;
    --error: #f87171;
    --warning: #fbbf24;
    --info: #60a5fa;
    --border: var(--vscode-panel-border);
    --font-mono: var(--vscode-editor-font-family);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--fg); padding: 16px; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin: 14px 0 8px; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }
  label { display: block; font-size: 11px; margin-bottom: 3px; opacity: 0.8; }
  input, select, textarea {
    width: 100%; padding: 6px 10px;
    background: var(--input-bg); border: 1px solid var(--input-border);
    color: var(--input-fg); font-size: 13px; font-family: var(--font-mono);
    border-radius: 4px; outline: none;
  }
  textarea { resize: vertical; font-family: var(--vscode-font-family); }
  .field { margin-bottom: 10px; }
  .actions { display: flex; gap: 8px; margin-top: 16px; }
  button {
    padding: 8px 16px; border: none; border-radius: 4px;
    background: var(--btn-bg); color: var(--btn-fg);
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: var(--btn-hover); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); }
  #log-container {
    margin-top: 16px; padding: 12px;
    background: var(--vscode-terminal-background, #1e1e1e);
    border-radius: 6px; font-family: var(--font-mono);
    font-size: 12px; line-height: 1.8;
    max-height: 400px; overflow-y: auto;
  }
  .log-entry { display: flex; gap: 6px; }
  .log-time { opacity: 0.5; min-width: 85px; }
  .log-level { font-weight: 700; min-width: 44px; }
  .log-stage { font-weight: 600; min-width: 70px; color: var(--info); }
  .log-info .log-level { color: var(--info); }
  .log-success .log-level, .log-success .log-msg { color: var(--success); }
  .log-error .log-level, .log-error .log-msg { color: var(--error); }
  .log-warning .log-level, .log-warning .log-msg { color: var(--warning); }
  .log-debug .log-level { opacity: 0.5; }
  #status { margin-top: 12px; font-size: 12px; opacity: 0.7; }
</style>
</head>
<body>
  <h1>SMTP Lab</h1>

  <h2>Connection</h2>
  <div class="row">
    <div class="field"><label>Host</label><input id="host" placeholder="smtp.gmail.com" /></div>
    <div class="field" style="max-width:100px"><label>Port</label><input id="port" type="number" value="587" /></div>
  </div>
  <div class="row">
    <div class="field"><label>Encryption</label>
      <select id="encryption">
        <option value="starttls" selected>STARTTLS</option>
        <option value="ssl">SSL/TLS</option>
        <option value="none">None</option>
      </select>
    </div>
  </div>

  <h2>Authentication</h2>
  <div class="field"><label>Username</label><input id="username" placeholder="user@example.com" /></div>
  <div class="field"><label>Password</label><input id="password" type="password" placeholder="App password" /></div>

  <h2>Message</h2>
  <div class="field"><label>From</label><input id="from" placeholder="sender@example.com" /></div>
  <div class="field"><label>To</label><input id="to" placeholder="recipient@example.com" /></div>
  <div class="field"><label>Subject</label><input id="subject" value="SMTP Lab Test Email" /></div>
  <div class="field"><label>Body</label><textarea id="body" rows="2">Test email from SMTP Lab.</textarea></div>

  <div class="actions">
    <button id="btn-test">Send Test Email</button>
    <button id="btn-diag" class="secondary">Diagnostics</button>
    <button id="btn-clear" class="secondary">Clear</button>
  </div>

  <div id="log-container"></div>
  <div id="status">Ready</div>

  <script>
    const vscode = acquireVsCodeApi();
    const logEl = document.getElementById("log-container");
    const statusEl = document.getElementById("status");
    const btnTest = document.getElementById("btn-test");
    const btnDiag = document.getElementById("btn-diag");

    function val(id) { return document.getElementById(id).value.trim(); }

    function addLog(entry) {
      const levelMap = { info: "log-info", success: "log-success", warning: "log-warning", error: "log-error", debug: "log-debug" };
      const labelMap = { info: "[INFO]", success: "[ OK ]", warning: "[WARN]", error: "[ERR ]", debug: "[DBG ]" };
      const cls = levelMap[entry.level] || "log-info";
      const label = labelMap[entry.level] || "[INFO]";
      const code = entry.smtp_code ? '<span style="font-weight:700;min-width:30px">' + entry.smtp_code + '</span>' : '';
      const div = document.createElement("div");
      div.className = "log-entry " + cls;
      div.innerHTML =
        '<span class="log-time">' + esc(entry.timestamp) + '</span>' +
        '<span class="log-level">' + label + '</span>' +
        '<span class="log-stage">' + esc(entry.stage) + '</span>' +
        code +
        '<span class="log-msg">' + esc(entry.message) + '</span>';
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function esc(s) {
      const d = document.createElement("div");
      d.textContent = s || "";
      return d.innerHTML;
    }

    btnTest.addEventListener("click", () => {
      logEl.innerHTML = "";
      statusEl.textContent = "Running...";
      btnTest.disabled = true;
      vscode.postMessage({
        command: "runTest",
        config: {
          host: val("host"), port: parseInt(val("port")) || 587,
          encryption: val("encryption"),
          username: val("username"), password: val("password"),
          from: val("from"), to: val("to"),
          subject: val("subject"), body: val("body"),
        }
      });
    });

    btnDiag.addEventListener("click", () => {
      logEl.innerHTML = "";
      statusEl.textContent = "Running diagnostics...";
      btnDiag.disabled = true;
      vscode.postMessage({
        command: "runDiagnostics",
        config: { host: val("host"), port: parseInt(val("port")) || 587, email: val("to") || val("from") }
      });
    });

    document.getElementById("btn-clear").addEventListener("click", () => {
      logEl.innerHTML = "";
      statusEl.textContent = "Ready";
    });

    document.getElementById("encryption").addEventListener("change", (e) => {
      const p = document.getElementById("port");
      if (e.target.value === "ssl") p.value = 465;
      else if (e.target.value === "starttls") p.value = 587;
      else p.value = 25;
    });

    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.command) {
        case "started":
          break;
        case "result":
          btnTest.disabled = false;
          if (msg.data.logs) msg.data.logs.forEach(addLog);
          statusEl.textContent = msg.data.success ? "Success (" + msg.data.elapsed_ms + "ms)" : "Failed";
          statusEl.style.color = msg.data.success ? "var(--success)" : "var(--error)";
          break;
        case "diagResult":
          btnDiag.disabled = false;
          if (msg.data.mx_records) {
            msg.data.mx_records.forEach(function(mx) {
              addLog({ timestamp: new Date().toISOString().substring(11,23), level: "success", stage: "DNS", message: "MX: " + mx.exchange + " (pri " + mx.preference + ")" });
            });
          }
          if (msg.data.starttls_supported !== null) {
            addLog({ timestamp: new Date().toISOString().substring(11,23), level: msg.data.starttls_supported ? "success" : "warning", stage: "STARTTLS", message: msg.data.starttls_supported ? "Supported" : "Not supported" });
          }
          statusEl.textContent = "Diagnostics complete";
          statusEl.style.color = "var(--info)";
          break;
        case "error":
          btnTest.disabled = false;
          btnDiag.disabled = false;
          addLog({ timestamp: new Date().toISOString().substring(11,23), level: "error", stage: "ERROR", message: msg.data });
          statusEl.textContent = "Error";
          statusEl.style.color = "var(--error)";
          break;
      }
    });
  </script>
</body>
</html>`;
}
