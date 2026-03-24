const { invoke } = window.__TAURI__.core;

const logContainer = document.getElementById("log-container");
const statusText = document.getElementById("status-text");
const statusElapsed = document.getElementById("status-elapsed");
const btnTest = document.getElementById("btn-test");
const btnDiagnose = document.getElementById("btn-diagnose");
const btnClear = document.getElementById("btn-clear");

function getFormInput() {
  return {
    host: document.getElementById("host").value.trim(),
    port: parseInt(document.getElementById("port").value) || 587,
    encryption: document.getElementById("encryption").value,
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value,
    from: document.getElementById("from").value.trim(),
    to: document.getElementById("to").value.trim(),
    subject: document.getElementById("subject").value,
    body: document.getElementById("body").value,
    timeout_secs: parseInt(document.getElementById("timeout").value) || 30,
  };
}

function levelClass(level) {
  const map = {
    info: "log-info",
    success: "log-success",
    warning: "log-warning",
    error: "log-error",
    debug: "log-debug",
  };
  return map[level] || "log-info";
}

function levelLabel(level) {
  const map = {
    info: "[INFO]",
    success: "[ OK ]",
    warning: "[WARN]",
    error: "[ERR ]",
    debug: "[DBG ]",
  };
  return map[level] || "[INFO]";
}

function addLogEntry(entry) {
  const el = document.createElement("div");
  el.className = `log-entry ${levelClass(entry.level)}`;

  const codeStr = entry.smtp_code ? `<span class="log-code">${entry.smtp_code}</span>` : "";

  el.innerHTML = `
    <span class="log-time">${entry.timestamp}</span>
    <span class="log-level">${levelLabel(entry.level)}</span>
    <span class="log-stage">${entry.stage}</span>
    ${codeStr}
    <span class="log-msg">${escapeHtml(entry.message)}</span>
  `;

  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function clearLogs() {
  logContainer.innerHTML = "";
}

function setLoading(loading) {
  btnTest.disabled = loading;
  btnDiagnose.disabled = loading;
  if (loading) {
    document.body.classList.add("loading");
    statusText.textContent = "Running…";
  } else {
    document.body.classList.remove("loading");
  }
}

async function runTest() {
  const input = getFormInput();

  if (!input.host || !input.from || !input.to) {
    addLogEntry({
      timestamp: new Date().toISOString().substr(11, 12),
      level: "error",
      stage: "VALIDATE",
      message: "Host, From, and To fields are required.",
    });
    return;
  }

  clearLogs();
  setLoading(true);

  const startTime = Date.now();

  try {
    const result = await invoke("smtp_test", { input });

    // Render all log entries
    for (const entry of result.logs) {
      addLogEntry(entry);
    }

    // Final status
    if (result.success) {
      statusText.textContent = "Success";
      statusText.style.color = "var(--success)";
    } else {
      statusText.textContent = "Failed";
      statusText.style.color = "var(--error)";
    }
  } catch (err) {
    addLogEntry({
      timestamp: new Date().toISOString().substr(11, 12),
      level: "error",
      stage: "FATAL",
      message: String(err),
    });
    statusText.textContent = "Error";
    statusText.style.color = "var(--error)";
  } finally {
    const elapsed = Date.now() - startTime;
    statusElapsed.textContent = `${elapsed}ms`;
    setLoading(false);
  }
}

async function runDiagnostics() {
  const input = getFormInput();

  if (!input.host) {
    addLogEntry({
      timestamp: new Date().toISOString().substr(11, 12),
      level: "error",
      stage: "VALIDATE",
      message: "Host is required for diagnostics.",
    });
    return;
  }

  clearLogs();
  setLoading(true);

  addLogEntry({
    timestamp: new Date().toISOString().substr(11, 12),
    level: "info",
    stage: "DIAG",
    message: "Running diagnostics…",
  });

  const startTime = Date.now();

  try {
    const result = await invoke("smtp_diagnose", {
      host: input.host,
      port: input.port,
      email: input.to || input.from || "test@example.com",
    });

    // Show MX records
    if (result.mx_records && result.mx_records.length > 0) {
      for (const mx of result.mx_records) {
        addLogEntry({
          timestamp: new Date().toISOString().substr(11, 12),
          level: "success",
          stage: "DNS",
          message: `MX → ${mx.exchange} (priority ${mx.preference})`,
        });
      }
    } else {
      addLogEntry({
        timestamp: new Date().toISOString().substr(11, 12),
        level: "warning",
        stage: "DNS",
        message: "No MX records found",
      });
    }

    // STARTTLS
    if (result.starttls_supported !== null) {
      addLogEntry({
        timestamp: new Date().toISOString().substr(11, 12),
        level: result.starttls_supported ? "success" : "warning",
        stage: "STARTTLS",
        message: result.starttls_supported ? "Supported" : "Not supported",
      });
    }

    // Cert
    if (result.cert_valid !== null) {
      addLogEntry({
        timestamp: new Date().toISOString().substr(11, 12),
        level: result.cert_valid ? "success" : "error",
        stage: "CERT",
        message: result.cert_valid ? "Certificate valid" : "Certificate invalid",
      });
    }

    statusText.textContent = "Diagnostics complete";
    statusText.style.color = "var(--info)";

    // Also fetch logs from backend
    const logs = await invoke("get_logs");
    for (const entry of logs) {
      addLogEntry(entry);
    }
  } catch (err) {
    addLogEntry({
      timestamp: new Date().toISOString().substr(11, 12),
      level: "error",
      stage: "DIAG",
      message: String(err),
    });
    statusText.textContent = "Diagnostics failed";
    statusText.style.color = "var(--error)";
  } finally {
    const elapsed = Date.now() - startTime;
    statusElapsed.textContent = `${elapsed}ms`;
    setLoading(false);
  }
}

// Event listeners
btnTest.addEventListener("click", runTest);
btnDiagnose.addEventListener("click", runDiagnostics);
btnClear.addEventListener("click", () => {
  clearLogs();
  statusText.textContent = "Idle";
  statusText.style.color = "";
  statusElapsed.textContent = "";
});

// Auto-set port based on encryption
document.getElementById("encryption").addEventListener("change", (e) => {
  const portInput = document.getElementById("port");
  switch (e.target.value) {
    case "ssl":
      portInput.value = 465;
      break;
    case "starttls":
      portInput.value = 587;
      break;
    case "none":
      portInput.value = 25;
      break;
  }
});
