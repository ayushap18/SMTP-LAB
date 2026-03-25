/* ===================================================================
   SMTP Lab — Application Logic
   =================================================================== */

const { invoke } = window.__TAURI__.core;

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Test page
const logContainer     = $("#log-container");
const statusText       = $("#status-text");
const statusElapsed    = $("#status-elapsed");
const statusIndicator  = $("#status-indicator");
const btnTest          = $("#btn-test");
const btnDiagnose      = $("#btn-diagnose");
const btnClear         = $("#btn-clear");
const btnCopyLogs      = $("#btn-copy-logs");
const btnExportLogs    = $("#btn-export-logs");
const btnTogglePw      = $("#btn-toggle-pw");

// History
const historyTbody     = $("#history-tbody");
const historyEmpty     = $("#history-empty");
const historySearch    = $("#history-search");
const historyTable     = $("#history-table");

// DNS
const dnsDomain        = $("#dns-domain");
const dkimSelector     = $("#dns-dkim-selector");
const dnsResults       = $("#dns-results");

// Templates
const templateList     = $("#template-list");
const templateEditor   = $("#template-editor");

// Settings
const setTimeoutSlider = $("#set-timeout");
const setTimeoutVal    = $("#set-timeout-val");
const setEncryption    = $("#set-encryption");

// Sidebar
const profileListEl    = $("#profile-list");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentPage     = "test";
let templates       = [];
let historyData     = [];
let profiles        = [];
let activeProfile   = null;
// Batch
let batchRows    = [];
let batchRunning = false;
let editingTemplate = null; // null = new, string = editing name

// Monitor
let monitorServers      = [];
let notificationsDenied = false;
let relativeTimeTicker  = null;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  loadSettings();
  loadFormState();
  loadTemplatesFromStorage();
  setupNavigation();
  setupTabs();
  setupTestPage();
  setupTemplatePage();
  setupHistoryPage();
  setupDnsPage();
  setupSettingsPage();
  setupTheme();
  setupBatchPage();
  setupMonitorPage();
  await loadProfiles();
  await loadHistory();
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function setupNavigation() {
  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${page}`));

  // Refresh data on navigate
  if (page === "history") refreshHistoryTable();
}

// ---------------------------------------------------------------------------
// Tabs (Test page sub-tabs)
// ---------------------------------------------------------------------------
function setupTabs() {
  $$(".page-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      const parent = tab.closest(".page");
      parent.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      parent.querySelectorAll(".tab-content").forEach((c) => c.classList.toggle("active", c.id === `tab-${target}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function setupTheme() {
  const saved = localStorage.getItem("smtplab-theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  $$('input[name="theme"]').forEach((r) => {
    r.checked = r.value === saved;
  });

  $("#btn-theme").addEventListener("click", toggleTheme);
  $$('input[name="theme"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      setTheme(e.target.value);
    });
  });
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("smtplab-theme", theme);
  $$('input[name="theme"]').forEach((r) => { r.checked = r.value === theme; });
}

// ---------------------------------------------------------------------------
// Toast Notifications
// ---------------------------------------------------------------------------
function showToast(message, type = "info") {
  const container = $("#toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3500);
}

// ---------------------------------------------------------------------------
// Form State Persistence
// ---------------------------------------------------------------------------
const FORM_FIELDS = ["host", "port", "encryption", "username", "from", "to", "subject", "body", "timeout"];

function saveFormState() {
  const state = {};
  FORM_FIELDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  localStorage.setItem("smtplab-form", JSON.stringify(state));
}

function loadFormState() {
  try {
    const state = JSON.parse(localStorage.getItem("smtplab-form") || "{}");
    FORM_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && state[id] !== undefined) el.value = state[id];
    });
  } catch { /* ignore */ }
}

// Save on every input change
document.addEventListener("input", (e) => {
  if (FORM_FIELDS.includes(e.target.id)) {
    saveFormState();
  }
});

// ---------------------------------------------------------------------------
// Settings Persistence
// ---------------------------------------------------------------------------
function saveSettings() {
  const settings = {
    timeout: parseInt(setTimeoutSlider.value) || 30,
    encryption: setEncryption.value,
  };
  localStorage.setItem("smtplab-settings", JSON.stringify(settings));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("smtplab-settings") || "{}");
    if (s.timeout) {
      setTimeoutSlider.value = s.timeout;
      setTimeoutVal.textContent = s.timeout + "s";
    }
    if (s.encryption) setEncryption.value = s.encryption;
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Test Page
// ---------------------------------------------------------------------------
function setupTestPage() {
  btnTest.addEventListener("click", runTest);
  btnDiagnose.addEventListener("click", runDiagnostics);
  btnClear.addEventListener("click", clearLogs);
  btnCopyLogs.addEventListener("click", copyLogs);
  btnExportLogs.addEventListener("click", exportLogs);
  btnTogglePw.addEventListener("click", () => {
    const pw = $("#password");
    pw.type = pw.type === "password" ? "text" : "password";
  });

  // Auto-set port on encryption change
  $("#encryption").addEventListener("change", (e) => {
    const portInput = $("#port");
    switch (e.target.value) {
      case "ssl":      portInput.value = 465; break;
      case "starttls": portInput.value = 587; break;
      case "none":     portInput.value = 25;  break;
    }
    saveFormState();
  });
}

function getFormInput() {
  return {
    host:        $("#host").value.trim(),
    port:        parseInt($("#port").value) || 587,
    encryption:  $("#encryption").value,
    username:    $("#username").value.trim(),
    password:    $("#password").value,
    from:        $("#from").value.trim(),
    to:          $("#to").value.trim(),
    subject:     $("#subject").value,
    body:        $("#body").value,
    html_body:   $("#html-mode").checked ? $("#body").value : null,
    timeout_secs: parseInt($("#timeout").value) || 30,
  };
}

// Log helpers
function levelClass(level) {
  return ({
    info: "log-info", success: "log-success", warning: "log-warning",
    error: "log-error", debug: "log-debug"
  })[level] || "log-info";
}

function levelLabel(level) {
  return ({
    info: "[INFO]", success: "[ OK ]", warning: "[WARN]",
    error: "[ERR ]", debug: "[DBG ]"
  })[level] || "[INFO]";
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

function clearLogs() {
  logContainer.innerHTML = "";
  setStatus("idle", "Idle", "");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function setLoading(loading) {
  btnTest.disabled = loading;
  btnDiagnose.disabled = loading;
  if (loading) {
    btnTest.classList.add("loading");
    setStatus("running", "Running...", "");
  } else {
    btnTest.classList.remove("loading");
  }
}

function setStatus(state, text, elapsed) {
  statusIndicator.className = `status-indicator ${state}`;
  statusText.textContent = text;
  statusText.style.color = "";
  statusElapsed.textContent = elapsed;
}

async function runTest() {
  const input = getFormInput();

  if (!input.host || !input.from || !input.to) {
    showToast("Host, From, and To fields are required.", "warning");
    addLogEntry({
      timestamp: nowTs(), level: "error", stage: "VALIDATE",
      message: "Host, From, and To fields are required.",
    });
    return;
  }

  logContainer.innerHTML = "";
  setLoading(true);
  const startTime = Date.now();

  // Subscribe to real-time log events from Rust (no job_id = single test page).
  let unlisten = null;
  try {
    unlisten = await window.__TAURI__.event.listen("smtp-log", (event) => {
      if (event.payload.job_id == null) addLogEntry(event.payload.entry);
    });
  } catch { /* fallback: logs rendered from result below */ }

  try {
    const result = await invoke("smtp_test", { input });
    // Streaming already rendered entries; if listen failed, render all at once.
    if (!unlisten) for (const entry of result.logs) addLogEntry(entry);

    if (result.success) {
      setStatus("success", "Success", `${result.elapsed_ms}ms`);
      showToast("Test email sent successfully!", "success");
    } else {
      setStatus("error", "Failed", `${result.elapsed_ms}ms`);
      showToast(result.message || "SMTP test failed.", "error");
    }
  } catch (err) {
    addLogEntry({ timestamp: nowTs(), level: "error", stage: "FATAL", message: String(err) });
    setStatus("error", "Error", `${Date.now() - startTime}ms`);
    showToast(friendlyError(err), "error");
  } finally {
    if (unlisten) unlisten();
    setLoading(false);
    await loadHistory();
  }
}

async function runDiagnostics() {
  const input = getFormInput();
  if (!input.host) {
    showToast("Host is required for diagnostics.", "warning");
    return;
  }

  logContainer.innerHTML = "";
  setLoading(true);
  addLogEntry({ timestamp: nowTs(), level: "info", stage: "DIAG", message: "Running diagnostics..." });
  const startTime = Date.now();

  try {
    const result = await invoke("smtp_diagnose", {
      host: input.host,
      port: input.port,
      email: input.to || input.from || "test@example.com",
    });

    if (result.mx_records && result.mx_records.length > 0) {
      for (const mx of result.mx_records) {
        addLogEntry({
          timestamp: nowTs(), level: "success", stage: "DNS",
          message: `MX: ${mx.exchange} (priority ${mx.preference})`,
        });
      }
    } else {
      addLogEntry({ timestamp: nowTs(), level: "warning", stage: "DNS", message: "No MX records found" });
    }

    if (result.starttls_supported !== null && result.starttls_supported !== undefined) {
      addLogEntry({
        timestamp: nowTs(),
        level: result.starttls_supported ? "success" : "warning",
        stage: "STARTTLS",
        message: result.starttls_supported ? "Supported" : "Not supported",
      });
    }

    if (result.cert_valid !== null && result.cert_valid !== undefined) {
      addLogEntry({
        timestamp: nowTs(),
        level: result.cert_valid ? "success" : "error",
        stage: "CERT",
        message: result.cert_valid ? "Certificate valid" : "Certificate invalid",
      });
    }

    const elapsed = Date.now() - startTime;
    setStatus("success", "Diagnostics complete", `${elapsed}ms`);
    showToast("Diagnostics completed.", "info");

    // Also fetch backend logs
    try {
      const logs = await invoke("get_logs");
      for (const entry of logs) addLogEntry(entry);
    } catch { /* ignore */ }

  } catch (err) {
    addLogEntry({ timestamp: nowTs(), level: "error", stage: "DIAG", message: String(err) });
    setStatus("error", "Diagnostics failed", `${Date.now() - startTime}ms`);
    showToast(friendlyError(err), "error");
  } finally {
    setLoading(false);
  }
}

async function copyLogs() {
  try {
    const text = Array.from(logContainer.querySelectorAll(".log-entry"))
      .map((el) => el.textContent.trim().replace(/\s+/g, " "))
      .join("\n");
    await navigator.clipboard.writeText(text);
    showToast("Logs copied to clipboard.", "success");
  } catch {
    showToast("Failed to copy logs.", "error");
  }
}

async function exportLogs() {
  try {
    const text = await invoke("export_logs", { format: "text" });
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, `smtp-lab-logs-${dateSlug()}.txt`);
    showToast("Logs exported.", "success");
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
}

// ---------------------------------------------------------------------------
// Templates Page
// ---------------------------------------------------------------------------
function setupTemplatePage() {
  $("#btn-new-template").addEventListener("click", () => openTemplateEditor(null));
  $("#btn-cancel-template").addEventListener("click", closeTemplateEditor);
  $("#btn-cancel-template-2").addEventListener("click", closeTemplateEditor);
  $("#btn-save-template").addEventListener("click", saveTemplate);
}

function loadTemplatesFromStorage() {
  try {
    templates = JSON.parse(localStorage.getItem("smtplab-templates") || "[]");
  } catch { templates = []; }
}

function saveTemplatesToStorage() {
  localStorage.setItem("smtplab-templates", JSON.stringify(templates));
}

function openTemplateEditor(tpl) {
  editingTemplate = tpl ? tpl.name : null;
  $("#template-editor-title").textContent = tpl ? "Edit Template" : "New Template";
  $("#tpl-name").value = tpl ? tpl.name : "";
  $("#tpl-from").value = tpl ? tpl.from : "";
  $("#tpl-to").value = tpl ? tpl.to : "";
  $("#tpl-subject").value = tpl ? tpl.subject : "";
  $("#tpl-body").value = tpl ? tpl.body : "";
  templateEditor.style.display = "";
  templateList.style.display = "none";
}

function closeTemplateEditor() {
  templateEditor.style.display = "none";
  templateList.style.display = "";
  renderTemplates();
}

function saveTemplate() {
  const name = $("#tpl-name").value.trim();
  if (!name) { showToast("Template name is required.", "warning"); return; }

  const tpl = {
    name,
    from: $("#tpl-from").value.trim(),
    to: $("#tpl-to").value.trim(),
    subject: $("#tpl-subject").value,
    body: $("#tpl-body").value,
  };

  if (editingTemplate) {
    const idx = templates.findIndex((t) => t.name === editingTemplate);
    if (idx >= 0) templates[idx] = tpl; else templates.push(tpl);
  } else {
    if (templates.some((t) => t.name === name)) {
      showToast("A template with this name already exists.", "warning");
      return;
    }
    templates.push(tpl);
  }

  saveTemplatesToStorage();
  closeTemplateEditor();
  showToast("Template saved.", "success");
}

function deleteTemplate(name) {
  templates = templates.filter((t) => t.name !== name);
  saveTemplatesToStorage();
  renderTemplates();
  showToast("Template deleted.", "info");
}

function useTemplate(tpl) {
  if (tpl.from)    $("#from").value = tpl.from;
  if (tpl.to)      $("#to").value = tpl.to;
  if (tpl.subject) $("#subject").value = tpl.subject;
  if (tpl.body)    $("#body").value = tpl.body;
  saveFormState();
  navigateTo("test");
  showToast(`Template "${tpl.name}" loaded.`, "success");
}

function renderTemplates() {
  if (templates.length === 0) {
    templateList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h3>No Templates</h3>
        <p>Create reusable email templates to speed up your testing workflow.</p>
      </div>`;
    return;
  }

  templateList.innerHTML = templates.map((t) => `
    <div class="template-card">
      <div class="template-card-info">
        <div class="template-card-name">${escapeHtml(t.name)}</div>
        <div class="template-card-detail">${escapeHtml(t.subject || "(no subject)")} &mdash; ${escapeHtml(t.to || "(no recipient)")}</div>
      </div>
      <div class="template-card-actions">
        <button class="btn btn-accent btn-sm" onclick="useTemplate(${JSON.stringify(t).replace(/"/g, '&quot;')})">Use</button>
        <button class="btn-icon" onclick="openTemplateEditor(${JSON.stringify(t).replace(/"/g, '&quot;')})" title="Edit">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" onclick="deleteTemplate('${escapeHtml(t.name)}')" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join("");
}

// Expose to inline onclick handlers
window.useTemplate    = useTemplate;
window.openTemplateEditor = openTemplateEditor;
window.deleteTemplate = deleteTemplate;

// ---------------------------------------------------------------------------
// History Page
// ---------------------------------------------------------------------------
function setupHistoryPage() {
  $("#btn-clear-history").addEventListener("click", async () => {
    try {
      await invoke("clear_history");
      historyData = [];
      refreshHistoryTable();
      showToast("History cleared.", "info");
    } catch (err) { showToast(friendlyError(err), "error"); }
  });

  $("#btn-export-history").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: "application/json" });
    downloadBlob(blob, `smtp-lab-history-${dateSlug()}.json`);
    showToast("History exported.", "success");
  });

  historySearch.addEventListener("input", () => refreshHistoryTable());
}

async function loadHistory() {
  try {
    historyData = await invoke("list_history", { limit: 200 });
    historyData.forEach(h => { if (!h.id) h.id = crypto.randomUUID(); });
  } catch { historyData = []; }
  refreshHistoryTable();
}

function refreshHistoryTable() {
  const query = (historySearch.value || "").toLowerCase();
  const filtered = historyData.filter((h) => {
    if (!query) return true;
    return h.host.toLowerCase().includes(query) ||
           (h.success ? "success" : "failed").includes(query) ||
           h.from.toLowerCase().includes(query) ||
           h.to.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    historyTable.style.display = "none";
    historyEmpty.style.display = "";
    return;
  }

  historyTable.style.display = "";
  historyEmpty.style.display = "none";

  historyTbody.innerHTML = filtered.map((h, i) => `
    <tr data-id="${h.id}">
      <td>${formatDate(h.timestamp)}</td>
      <td style="font-family:var(--font-mono);font-size:12px;">${escapeHtml(h.host)}:${h.port}</td>
      <td style="font-size:12px;">${escapeHtml(h.from)} &rarr; ${escapeHtml(h.to)}</td>
      <td><span class="status-badge ${h.success ? 'success' : 'error'}">${h.success ? 'Success' : 'Failed'}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px;">${h.elapsed_ms}ms</td>
      <td>
        <button class="expand-btn" onclick="toggleHistoryDetail(this, '${h.id}')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </td>
    </tr>
  `).join("");
}

window.toggleHistoryDetail = function (btn, id) {
  const tr = btn.closest("tr");
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains("history-detail-row")) {
    existing.remove();
    btn.classList.remove("expanded");
    return;
  }

  btn.classList.add("expanded");
  const h = historyData.find(entry => entry.id === id);
  if (!h) return;
  const detailRow = document.createElement("tr");
  detailRow.className = "history-detail-row";
  const td = document.createElement("td");
  td.colSpan = 6;

  let logsHtml = '<div class="log-container">';
  if (h.logs && h.logs.length > 0) {
    for (const entry of h.logs) {
      const codeStr = entry.smtp_code ? `<span class="log-code">${entry.smtp_code}</span>` : "";
      logsHtml += `
        <div class="log-entry ${levelClass(entry.level)}">
          <span class="log-time">${entry.timestamp}</span>
          <span class="log-level">${levelLabel(entry.level)}</span>
          <span class="log-stage">${entry.stage}</span>
          ${codeStr}
          <span class="log-msg">${escapeHtml(entry.message)}</span>
        </div>`;
    }
  } else {
    logsHtml += '<div class="text-dim" style="padding:8px 0;">No log entries recorded.</div>';
  }
  logsHtml += "</div>";

  td.innerHTML = logsHtml;
  detailRow.appendChild(td);
  tr.after(detailRow);
};

// ---------------------------------------------------------------------------
// Batch Page
// ---------------------------------------------------------------------------
function setupBatchPage() {
  $("#btn-batch-add").addEventListener("click", addBatchRow);
  $("#btn-batch-run").addEventListener("click", runBatch);
  $("#btn-batch-clear").addEventListener("click", clearBatch);

  // Import
  $("#btn-batch-import").addEventListener("click", () => $("#batch-import-file").click());
  $("#batch-import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importBatchCSV(file);
    e.target.value = ""; // reset so same file can be re-imported
  });

  // Export dropdown
  $("#btn-batch-export").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#batch-export-menu");
    menu.style.display = menu.style.display === "none" ? "" : "none";
  });
  document.addEventListener("click", () => {
    const menu = $("#batch-export-menu");
    if (menu) menu.style.display = "none";
  });
  $("#btn-batch-export-csv").addEventListener("click",  () => exportBatch("csv"));
  $("#btn-batch-export-json").addEventListener("click", () => exportBatch("json"));
}

function addBatchRow() {
  const id = crypto.randomUUID();
  batchRows.push({
    id, host: "", port: 587, enc: "starttls",
    user: "", pass: "", from: "", to: "",
    subject: "SMTP Lab Batch Test",
    status: "idle", result: null, liveLog: [], drawerOpen: false,
  });
  renderBatchTable();
}

function clearBatch() {
  batchRows = [];
  batchRunning = false;
  renderBatchTable();
  $("#batch-summary").style.display = "none";
}

function batchStatusHtml(row) {
  switch (row.status) {
    case "idle":    return `<span class="batch-pill idle">IDLE</span>`;
    case "running": return `<span class="batch-pill running"><span class="batch-spinner"></span>RUNNING</span>`;
    case "success": return `<span class="batch-pill success">✓ OK</span>`;
    case "failed":  return `<span class="batch-pill failed" title="${escapeHtml(row.result?.message || "")}">✗ FAIL</span>`;
    case "skipped": return `<span class="batch-pill skipped">SKIP</span>`;
    default:        return "";
  }
}

function renderBatchTable() {
  const tbody = $("#batch-tbody");
  const empty = $("#batch-empty");
  const table = $("#batch-table");
  if (batchRows.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "";
    table.style.display = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "";

  tbody.innerHTML = batchRows.map((r, i) => `
    <tr data-batch-id="${r.id}">
      <td class="batch-num-cell">
        <span class="batch-row-num">${i + 1}</span>
        <button class="batch-row-delete" title="Delete row" onclick="deleteBatchRow('${r.id}')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
      <td><input type="text"     class="bi-host"    value="${escapeHtml(r.host)}"    placeholder="smtp.example.com" /></td>
      <td><input type="number"   class="bi-port"    value="${r.port}"                style="width:60px" /></td>
      <td>
        <select class="bi-enc">
          <option value="starttls" ${r.enc==="starttls"?"selected":""}>STARTTLS</option>
          <option value="ssl"      ${r.enc==="ssl"     ?"selected":""}>SSL/TLS</option>
          <option value="none"     ${r.enc==="none"    ?"selected":""}>None</option>
        </select>
      </td>
      <td><input type="text"     class="bi-user"    value="${escapeHtml(r.user)}"    placeholder="username" /></td>
      <td><input type="password" class="bi-pass"    value="${escapeHtml(r.pass)}"    placeholder="••••••••" /></td>
      <td><input type="email"    class="bi-from"    value="${escapeHtml(r.from)}"    placeholder="from@example.com" /></td>
      <td><input type="email"    class="bi-to"      value="${escapeHtml(r.to)}"      placeholder="to@example.com" /></td>
      <td><input type="text"     class="bi-subject" value="${escapeHtml(r.subject)}" placeholder="Subject" /></td>
      <td class="batch-status-cell">${batchStatusHtml(r)}</td>
      <td class="batch-latency-cell">${r.result?.elapsed_ms != null ? r.result.elapsed_ms + "ms" : "—"}</td>
      <td>
        <button class="expand-btn${r.drawerOpen ? " expanded" : ""}"
                onclick="toggleBatchDetail(this, '${r.id}')" title="View logs">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </td>
    </tr>
    ${r.drawerOpen ? `<tr class="batch-detail-row" data-detail-for="${r.id}"><td colspan="12">${buildBatchDrawerHtml(r)}</td></tr>` : ""}
  `).join("");

  tbody.querySelectorAll("tr[data-batch-id]").forEach(tr => {
    const row = batchRows.find(r => r.id === tr.dataset.batchId);
    if (!row) return;
    tr.querySelector(".bi-host").addEventListener("change",    e => { row.host    = e.target.value; });
    tr.querySelector(".bi-port").addEventListener("change",    e => { row.port    = parseInt(e.target.value) || 587; });
    tr.querySelector(".bi-enc").addEventListener("change",     e => { row.enc     = e.target.value; });
    tr.querySelector(".bi-user").addEventListener("change",    e => { row.user    = e.target.value; });
    tr.querySelector(".bi-pass").addEventListener("change",    e => { row.pass    = e.target.value; });
    tr.querySelector(".bi-from").addEventListener("change",    e => { row.from    = e.target.value; });
    tr.querySelector(".bi-to").addEventListener("change",      e => { row.to      = e.target.value; });
    tr.querySelector(".bi-subject").addEventListener("change", e => { row.subject = e.target.value; });
  });
}

function buildBatchDrawerHtml(row) {
  const logs = row.liveLog?.length ? row.liveLog : (row.result?.logs || []);
  if (logs.length === 0) {
    const msg = row.result?.message || row.result?.error || (row.status === "idle" ? "Run the batch to see logs." : "No logs.");
    return `<div class="batch-drawer"><div class="text-dim" style="padding:6px 0;font-size:12px;">${escapeHtml(msg)}</div></div>`;
  }
  const entries = logs.map(e => {
    const code = e.smtp_code ? `<span class="log-code">${e.smtp_code}</span>` : "";
    return `<div class="log-entry ${levelClass(e.level)}">
      <span class="log-time">${e.timestamp}</span>
      <span class="log-level">${levelLabel(e.level)}</span>
      <span class="log-stage">${e.stage}</span>${code}
      <span class="log-msg">${escapeHtml(e.message)}</span>
    </div>`;
  }).join("");
  return `<div class="batch-drawer"><div class="log-container" style="max-height:180px;">${entries}</div></div>`;
}

window.deleteBatchRow = function(id) {
  if (batchRunning) return;
  batchRows = batchRows.filter(r => r.id !== id);
  renderBatchTable();
};

window.toggleBatchDetail = function(btn, id) {
  const row = batchRows.find(r => r.id === id);
  if (!row) return;
  row.drawerOpen = !row.drawerOpen;
  renderBatchTable();
  // Scroll the drawer into view
  if (row.drawerOpen) {
    const drawerTr = $("#batch-tbody").querySelector(`[data-detail-for="${id}"]`);
    if (drawerTr) drawerTr.scrollIntoView({ block: "nearest" });
  }
};

function syncBatchRowsFromDom() {
  $("#batch-tbody").querySelectorAll("tr[data-batch-id]").forEach(tr => {
    const row = batchRows.find(r => r.id === tr.dataset.batchId);
    if (!row) return;
    row.host    = tr.querySelector(".bi-host")?.value    || "";
    row.port    = parseInt(tr.querySelector(".bi-port")?.value) || 587;
    row.enc     = tr.querySelector(".bi-enc")?.value     || "starttls";
    row.user    = tr.querySelector(".bi-user")?.value    || "";
    row.pass    = tr.querySelector(".bi-pass")?.value    || "";
    row.from    = tr.querySelector(".bi-from")?.value    || "";
    row.to      = tr.querySelector(".bi-to")?.value      || "";
    row.subject = tr.querySelector(".bi-subject")?.value || "";
  });
}

function updateBatchRowStatus(row) {
  const tr = $("#batch-tbody").querySelector(`tr[data-batch-id="${row.id}"]`);
  if (!tr) return;
  const statusCell  = tr.querySelector(".batch-status-cell");
  const latencyCell = tr.querySelector(".batch-latency-cell");
  if (statusCell)  statusCell.innerHTML = batchStatusHtml(row);
  if (latencyCell) latencyCell.textContent = row.result?.elapsed_ms != null ? row.result.elapsed_ms + "ms" : "—";

  // Refresh live drawer if open
  const drawerTr = $("#batch-tbody").querySelector(`[data-detail-for="${row.id}"]`);
  if (drawerTr) drawerTr.querySelector("td").innerHTML = buildBatchDrawerHtml(row);
}

function appendBatchRowLiveLog(row, entry) {
  if (!row.liveLog) row.liveLog = [];
  row.liveLog.push(entry);
  const drawerTr = $("#batch-tbody").querySelector(`[data-detail-for="${row.id}"]`);
  if (!drawerTr) return;
  const logContainer = drawerTr.querySelector(".log-container");
  if (!logContainer) {
    drawerTr.querySelector("td").innerHTML = buildBatchDrawerHtml(row);
    return;
  }
  const el = document.createElement("div");
  el.className = `log-entry ${levelClass(entry.level)}`;
  const code = entry.smtp_code ? `<span class="log-code">${entry.smtp_code}</span>` : "";
  el.innerHTML = `<span class="log-time">${entry.timestamp}</span><span class="log-level">${levelLabel(entry.level)}</span><span class="log-stage">${entry.stage}</span>${code}<span class="log-msg">${escapeHtml(entry.message)}</span>`;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateBatchProgress() {
  const done    = batchRows.filter(r => r.status !== "idle" && r.status !== "running").length;
  const running = batchRows.filter(r => r.status === "running").length;
  const total   = batchRows.length;
  const bar     = $("#batch-progress");
  if (!bar) return;
  if (!batchRunning) { bar.style.display = "none"; return; }
  bar.style.display = "";
  $("#bp-text").textContent = `${done}/${total} done · ${running} running`;
  $("#bp-fill").style.width = `${(done / total) * 100}%`;
}

async function runBatch() {
  if (batchRunning) return;
  if (batchRows.length === 0) { showToast("Add at least one row.", "warning"); return; }

  syncBatchRowsFromDom();
  batchRows.forEach(r => { r.status = "idle"; r.result = null; r.liveLog = []; r.drawerOpen = false; });
  renderBatchTable();
  $("#batch-summary").style.display = "none";
  batchRunning = true;
  updateBatchProgress();

  const progressTick = setInterval(updateBatchProgress, 300);

  await runWithConcurrency(batchRows, 10, async (row) => {
    row.status = "running";
    row.liveLog = [];
    if (row.drawerOpen) renderBatchTable();
    else updateBatchRowStatus(row);

    if (!row.host || !row.from || !row.to) {
      row.status = "skipped";
      row.result = { success: false, message: "Missing required fields (host, from, to)", logs: [], elapsed_ms: 0 };
      updateBatchRowStatus(row);
      return;
    }

    // Subscribe to real-time log events for this specific job.
    let unlisten = null;
    try {
      unlisten = await window.__TAURI__.event.listen("smtp-log", (event) => {
        if (event.payload.job_id === row.id) {
          appendBatchRowLiveLog(row, event.payload.entry);
        }
      });
    } catch { /* streaming unavailable, logs render from result */ }

    const input = {
      host: row.host, port: row.port, encryption: row.enc,
      username: row.user, password: row.pass,
      from: row.from, to: row.to, subject: row.subject,
      body: "SMTP Lab batch test", html_body: null, timeout_secs: 30,
      job_id: row.id,
    };

    try {
      const result = await invoke("smtp_test", { input });
      row.status = result.success ? "success" : "failed";
      row.result = result;
    } catch (err) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      row.status = "failed";
      row.result = { success: false, message: msg, error: msg, logs: [], elapsed_ms: 0 };
    } finally {
      if (unlisten) unlisten();
    }
    updateBatchRowStatus(row);
  });

  clearInterval(progressTick);
  batchRunning = false;
  updateBatchProgress();
  showBatchSummary();
}

function showBatchSummary() {
  const total  = batchRows.length;
  const passed = batchRows.filter(r => r.status === "success").length;
  const failed = batchRows.filter(r => r.status === "failed" || r.status === "skipped").length;
  const times  = batchRows.filter(r => r.result?.elapsed_ms).map(r => r.result.elapsed_ms);
  const avg    = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  $("#bs-total").textContent  = total;
  $("#bs-passed").textContent = passed;
  $("#bs-failed").textContent = failed;
  $("#bs-avg").textContent    = avg != null ? avg + "ms" : "—";
  $("#batch-summary").style.display = "";
}

async function runWithConcurrency(items, limit, fn) {
  const queue = [...items];
  let active  = 0;
  return new Promise((resolve) => {
    function next() {
      if (queue.length === 0 && active === 0) { resolve(); return; }
      while (active < limit && queue.length > 0) {
        const item = queue.shift();
        active++;
        fn(item).finally(() => { active--; next(); });
      }
    }
    next();
  });
}

// Parse one CSV line respecting quoted fields.
function parseCSVLine(line) {
  const result = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function importBatchCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { showToast("CSV must have a header row and at least one data row.", "warning"); return; }

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''));
    const get = (row, key) => {
      const idx = header.indexOf(key);
      return idx >= 0 ? (row[idx] || "").replace(/^"|"$/g, '') : "";
    };

    const imported = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const host = get(vals, "host");
      if (!host) return null;
      return {
        id: crypto.randomUUID(),
        host, port: parseInt(get(vals, "port")) || 587,
        enc: get(vals, "encryption") || "starttls",
        user: get(vals, "username") || "",
        pass: get(vals, "password") || "",
        from: get(vals, "from") || "",
        to: get(vals, "to") || "",
        subject: get(vals, "subject") || "SMTP Lab Batch Test",
        status: "idle", result: null, liveLog: [], drawerOpen: false,
      };
    }).filter(Boolean);

    if (imported.length === 0) { showToast("No valid rows found in CSV.", "warning"); return; }
    batchRows.push(...imported);
    renderBatchTable();
    showToast(`Imported ${imported.length} row${imported.length > 1 ? "s" : ""}.`, "success");
  };
  reader.onerror = () => showToast("Failed to read file.", "error");
  reader.readAsText(file);
}

function exportBatch(format) {
  const ts = new Date().toISOString();
  if (format === "csv") {
    const header = "host,port,encryption,from,to,subject,status,latency_ms,timestamp";
    const rows = batchRows.map(r => {
      const status = r.status === "idle" ? "" :
                     r.status === "running" ? "running" :
                     r.status === "success" ? "success" :
                     r.status === "skipped" ? "skipped" : "failed";
      return [r.host, r.port, r.enc, r.from, r.to, r.subject,
              status, r.result?.elapsed_ms ?? "", ts]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    downloadBlob(blob, `smtp-batch-${dateSlug()}.csv`);
  } else {
    const data = batchRows.map(r => ({
      host: r.host, port: r.port, encryption: r.enc,
      from: r.from, to: r.to, subject: r.subject,
      success: r.result?.success ?? null, message: r.result?.message ?? null,
      elapsed_ms: r.result?.elapsed_ms ?? null, logs: r.result?.logs ?? [],
      exported_at: ts,
    }));
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `smtp-batch-${dateSlug()}.json`);
  }
  showToast(`Batch exported as ${format.toUpperCase()}.`, "success");
}

// ---------------------------------------------------------------------------
// Monitor Page
// ---------------------------------------------------------------------------
function setupMonitorPage() {
  $("#btn-monitor-add").addEventListener("click", () => {
    $("#mon-name").value = "";
    $("#mon-host").value = "";
    $("#mon-port").value = "587";
    $("#monitor-add-modal").style.display = "";
  });
  $("#btn-monitor-modal-close").addEventListener("click",  closeMonitorModal);
  $("#btn-monitor-modal-cancel").addEventListener("click", closeMonitorModal);
  $("#btn-monitor-modal-save").addEventListener("click",   saveMonitorServer);
  $("#btn-monitor-start-all").addEventListener("click",    monitorStartAll);
  $("#btn-monitor-stop-all").addEventListener("click",     monitorStopAll);

  loadMonitorServers();
  relativeTimeTicker = setInterval(updateRelativeTimes, 1000);
}

function closeMonitorModal() {
  $("#monitor-add-modal").style.display = "none";
}

function saveMonitorServer() {
  const host = $("#mon-host").value.trim();
  if (!host) { showToast("Host is required.", "warning"); return; }
  const name       = $("#mon-name").value.trim() || host;
  const port       = parseInt($("#mon-port").value) || 587;
  const encryption = $("#mon-encryption").value || "starttls";
  const intervalMs = parseInt($("#mon-interval-local").value) || 60000;
  const saved = { id: crypto.randomUUID(), name, host, port, encryption, interval_ms: intervalMs };
  monitorServers.push(createMonitorEntry(saved));
  persistMonitorServers();
  renderMonitorGrid();
  closeMonitorModal();
  showToast(`"${name}" added.`, "success");
}

function createMonitorEntry(saved) {
  return {
    ...saved,
    timer: null, status: "idle",
    lastMs: null, lastChecked: null,
    checks: { ok: 0, total: 0 },
    sparkData: [], sparkChart: null,
    detailOpen: false, detailLog: [],
  };
}

function loadMonitorServers() {
  try {
    const saved = JSON.parse(localStorage.getItem("smtplab-monitor-servers") || "[]");
    monitorServers = saved.map(createMonitorEntry);
  } catch { monitorServers = []; }
  renderMonitorGrid();
}

function persistMonitorServers() {
  const toSave = monitorServers.map(({ id, name, host, port, encryption, interval_ms }) =>
    ({ id, name, host, port, encryption: encryption || "starttls", interval_ms }));
  localStorage.setItem("smtplab-monitor-servers", JSON.stringify(toSave));
}

function renderMonitorGrid() {
  const grid  = $("#monitor-grid");
  const empty = $("#monitor-empty");

  const currentIds = new Set(monitorServers.map(s => s.id));
  grid.querySelectorAll(".monitor-card").forEach(c => {
    if (!currentIds.has(c.dataset.serverId)) c.remove();
  });

  if (monitorServers.length === 0) {
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";

  const existingIds = new Set([...grid.querySelectorAll(".monitor-card")]
    .map(c => c.dataset.serverId));

  for (const srv of monitorServers) {
    if (!existingIds.has(srv.id)) {
      grid.appendChild(buildMonitorCard(srv));
    }
    updateMonitorCard(srv);
  }
}

function buildMonitorCard(srv) {
  const card = document.createElement("div");
  card.className = "monitor-card";
  card.dataset.serverId = srv.id;
  const encLabel = { starttls: "STARTTLS", ssl: "SSL/TLS", none: "Plain" }[srv.encryption || "starttls"] || "STARTTLS";
  const encClass = { starttls: "enc-starttls", ssl: "enc-ssl", none: "enc-none" }[srv.encryption || "starttls"] || "enc-starttls";
  const intervalLabel = srv.interval_ms >= 60000 ? `${srv.interval_ms/60000}m` : `${srv.interval_ms/1000}s`;

  card.innerHTML = `
    <div class="monitor-card-header">
      <div class="monitor-card-title-row" onclick="toggleMonitorDetail('${srv.id}')">
        <div class="monitor-card-name-wrap">
          <div class="monitor-card-name">${escapeHtml(srv.name)}</div>
          <div class="monitor-card-meta">
            <span class="monitor-card-host">${escapeHtml(srv.host)}:${srv.port}</span>
            <span class="enc-pill ${encClass}">${encLabel}</span>
            <span class="interval-pill">every ${intervalLabel}</span>
          </div>
        </div>
        <span class="monitor-badge idle" data-badge>IDLE</span>
      </div>
    </div>

    <div class="monitor-card-body" onclick="toggleMonitorDetail('${srv.id}')">
      <div class="monitor-metrics-row">
        <div class="monitor-metric">
          <span class="monitor-metric-label">Latency</span>
          <span class="monitor-metric-value" data-last-ms>&#8212;</span>
        </div>
        <div class="monitor-metric">
          <span class="monitor-metric-label">Uptime</span>
          <span class="monitor-metric-value" data-uptime>&#8212;</span>
        </div>
        <div class="monitor-metric">
          <span class="monitor-metric-label">Checks</span>
          <span class="monitor-metric-value" data-checks>0</span>
        </div>
      </div>
      <div class="monitor-sparkline-wrap" data-sparkwrap>
        ${window.Chart
          ? `<canvas data-spark style="display:block;"></canvas>`
          : `<span class="chart-unavailable">(chart unavailable)</span>`}
      </div>
    </div>

    <div class="monitor-card-footer">
      <span class="monitor-last-checked" data-last-checked>Never checked</span>
      <div class="monitor-card-controls" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm monitor-toggle-btn"
          data-toggle-btn onclick="toggleMonitorServer('${srv.id}')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start
        </button>
        <button class="btn-icon" title="Delete server" onclick="deleteMonitorServer('${srv.id}')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="monitor-detail-panel" style="display:none;" data-detail
         onclick="event.stopPropagation()"></div>
  `;

  if (window.Chart) {
    const canvas = card.querySelector("[data-spark]");
    canvas.width  = 280;
    canvas.height = 48;
    srv.sparkChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: Array(20).fill(""),
        datasets: [{
          data: [],
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.08)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      },
    });
  }
  return card;
}

function updateMonitorCard(srv) {
  const card = $("#monitor-grid").querySelector(`[data-server-id="${srv.id}"]`);
  if (!card) return;

  const badge = card.querySelector("[data-badge]");
  if (badge) {
    badge.className = `monitor-badge ${srv.status}`;
    badge.textContent = ({ idle:"IDLE", checking:"···", reachable:"REACHABLE", down:"DOWN", slow:"SLOW" })[srv.status] || srv.status.toUpperCase();
  }
  const lastMsEl = card.querySelector("[data-last-ms]");
  if (lastMsEl) lastMsEl.textContent = srv.lastMs != null ? srv.lastMs + " ms" : "—";

  const uptimeEl = card.querySelector("[data-uptime]");
  if (uptimeEl) {
    const pct = srv.checks.total > 0
      ? (srv.checks.ok / srv.checks.total * 100).toFixed(1) : null;
    uptimeEl.textContent = pct != null ? `${pct}%` : "—";
  }

  const checksEl = card.querySelector("[data-checks]");
  if (checksEl) checksEl.textContent = srv.checks.total || 0;

  const toggleBtn = card.querySelector("[data-toggle-btn]");
  if (toggleBtn) {
    if (srv.timer) {
      toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
      toggleBtn.className = "btn btn-secondary btn-sm monitor-toggle-btn";
    } else {
      toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start`;
      toggleBtn.className = "btn btn-primary btn-sm monitor-toggle-btn";
    }
  }

  if (srv.sparkChart && srv.sparkData.length > 0) {
    srv.sparkChart.data.datasets[0].data = [...srv.sparkData];
    srv.sparkChart.update("none");
  }
}

window.toggleMonitorDetail = function(id) {
  const srv = monitorServers.find(s => s.id === id);
  if (!srv) return;
  const card = $("#monitor-grid").querySelector(`[data-server-id="${id}"]`);
  if (!card) return;
  const panel = card.querySelector("[data-detail]");
  if (!panel) return;
  srv.detailOpen = !srv.detailOpen;
  panel.style.display = srv.detailOpen ? "" : "none";
  if (srv.detailOpen) renderMonitorDetail(srv, panel);
};

function renderMonitorDetail(srv, panel) {
  if (srv.detailLog.length === 0) {
    panel.innerHTML = '<div class="text-dim" style="padding:6px 0;font-size:12px;">No checks yet.</div>';
    return;
  }
  panel.innerHTML = [...srv.detailLog].slice(-50).reverse().map(e => `
    <div class="monitor-detail-row">
      <span class="mdr-time">${e.ts}</span>
      <span class="mdr-ms">${e.ms != null ? e.ms + "ms" : "—"}</span>
      <span class="mdr-status ${e.status}">${e.status.toUpperCase()}</span>
      ${e.error ? `<span class="text-dim" style="font-size:11px;">${escapeHtml(e.error)}</span>` : ""}
    </div>`).join("");
}

window.toggleMonitorServer = function(id) {
  const srv = monitorServers.find(s => s.id === id);
  if (!srv) return;
  srv.timer ? stopMonitorServer(srv) : startMonitorServer(srv);
};

window.deleteMonitorServer = function(id) {
  const srv = monitorServers.find(s => s.id === id);
  if (srv?.timer) stopMonitorServer(srv);
  if (srv?.sparkChart) srv.sparkChart.destroy();
  monitorServers = monitorServers.filter(s => s.id !== id);
  persistMonitorServers();
  renderMonitorGrid();
};

function startMonitorServer(srv) {
  if (srv.timer) return;
  pingServer(srv);
  srv.timer = setInterval(() => pingServer(srv), srv.interval_ms);
  updateMonitorCard(srv);
}

function stopMonitorServer(srv) {
  if (srv.timer) { clearInterval(srv.timer); srv.timer = null; }
  updateMonitorCard(srv);
}

async function pingServer(srv) {
  const prevStatus = srv.status === "checking"
    ? (srv.lastMs != null ? (srv.lastMs >= 2000 ? "slow" : "reachable") : "idle")
    : srv.status;
  srv.status = "checking";
  updateMonitorCard(srv);

  let newStatus, ms, errorMsg;
  try {
    const result = await invoke("smtp_ping", { host: srv.host, port: srv.port });
    ms = result.latency_ms;
    if (!result.reachable) {
      newStatus = "down";
      errorMsg  = result.error || "Unreachable";
    } else {
      newStatus = ms >= 2000 ? "slow" : "reachable";
    }
  } catch (err) {
    newStatus = "down";
    ms        = null;
    errorMsg  = typeof err === "string" ? err : JSON.stringify(err);
  }

  srv.lastMs      = ms;
  srv.lastChecked = Date.now();
  srv.checks.total++;
  if (newStatus === "reachable" || newStatus === "slow") srv.checks.ok++;
  if (ms != null) { srv.sparkData.push(ms); if (srv.sparkData.length > 20) srv.sparkData.shift(); }
  srv.detailLog.push({ ts: new Date().toLocaleTimeString(), ms, status: newStatus, error: errorMsg });
  if (srv.detailLog.length > 200) srv.detailLog.shift();

  srv.status = newStatus;

  if (prevStatus !== "idle" && prevStatus !== "checking" && prevStatus !== newStatus) {
    fireMonitorNotification(srv, newStatus);
  }

  updateMonitorCard(srv);
  if (srv.detailOpen) {
    const card = $("#monitor-grid").querySelector(`[data-server-id="${srv.id}"]`);
    if (card) renderMonitorDetail(srv, card.querySelector("[data-detail]"));
  }
}

function fireMonitorNotification(srv, newStatus) {
  if (notificationsDenied || !window.Notification) return;
  if (Notification.permission !== "granted") return;
  const msgs = { down: "is DOWN", reachable: "is back REACHABLE", slow: "is SLOW (high latency)" };
  if (!msgs[newStatus]) return;
  new Notification("SMTP Lab Monitor", {
    body: `${srv.name} (${srv.host}:${srv.port}) ${msgs[newStatus]}`,
  });
}

async function monitorStartAll() {
  if (window.Notification && Notification.permission === "default" && !notificationsDenied) {
    const perm = await Notification.requestPermission();
    if (perm === "denied") {
      notificationsDenied = true;
      showToast("Notifications blocked. Enable in System Preferences for server alerts.", "info");
    }
  }
  monitorServers.forEach(startMonitorServer);
}

function monitorStopAll() {
  monitorServers.forEach(stopMonitorServer);
}

function updateRelativeTimes() {
  monitorServers.forEach(srv => {
    const card = $("#monitor-grid").querySelector(`[data-server-id="${srv.id}"]`);
    if (!card) return;
    const el = card.querySelector("[data-last-checked]");
    if (!el) return;
    if (!srv.lastChecked) { el.textContent = "Never checked"; return; }
    const secs = Math.round((Date.now() - srv.lastChecked) / 1000);
    el.textContent = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
  });
}

// ---------------------------------------------------------------------------
// DNS Tools Page
// ---------------------------------------------------------------------------
function setupDnsPage() {
  $("#btn-dns-mx").addEventListener("click", () => runDnsLookup("mx"));
  $("#btn-dns-spf").addEventListener("click", () => runDnsLookup("spf"));
  $("#btn-dns-dkim").addEventListener("click", () => runDnsLookup("dkim"));
  $("#btn-dns-dmarc").addEventListener("click", () => runDnsLookup("dmarc"));
  $("#btn-dns-all").addEventListener("click", () => runDnsLookup("all"));
}

async function runDnsLookup(type) {
  const domain = dnsDomain.value.trim();
  if (!domain) {
    showToast("Enter a domain name.", "warning");
    return;
  }

  // Clear existing results if doing "all"
  if (type === "all") dnsResults.innerHTML = "";

  const types = type === "all" ? ["mx", "spf", "dkim", "dmarc"] : [type];

  for (const t of types) {
    const card = createDnsCard(t, domain, "loading");
    dnsResults.prepend(card);

    try {
      let result, body;
      switch (t) {
        case "mx":
          result = await invoke("dns_mx_lookup", { domain });
          if (result.length === 0) {
            updateDnsCard(card, "missing", "No MX records found.");
          } else {
            body = result.map((r) => `Priority ${r.preference}  ${r.exchange}`).join("\n");
            updateDnsCard(card, "found", body);
          }
          break;
        case "spf":
          result = await invoke("dns_check_spf", { domain });
          if (result) {
            updateDnsCard(card, "found", result);
          } else {
            updateDnsCard(card, "missing", "No SPF record found.");
          }
          break;
        case "dkim":
          const selector = dkimSelector.value.trim() || "google";
          result = await invoke("dns_check_dkim", { domain, selector });
          if (result) {
            updateDnsCard(card, "found", result);
          } else {
            updateDnsCard(card, "missing", `No DKIM record found for selector "${selector}".`);
          }
          break;
        case "dmarc":
          result = await invoke("dns_check_dmarc", { domain });
          if (result) {
            updateDnsCard(card, "found", result);
          } else {
            updateDnsCard(card, "missing", "No DMARC record found.");
          }
          break;
      }
    } catch (err) {
      updateDnsCard(card, "error", friendlyError(err));
    }
  }
}

function createDnsCard(type, domain, state) {
  const titles = { mx: "MX Records", spf: "SPF Record", dkim: "DKIM Record", dmarc: "DMARC Record" };
  const card = document.createElement("div");
  card.className = "dns-card";
  card.innerHTML = `
    <div class="dns-card-header">
      <h4>${titles[type] || type.toUpperCase()} <span class="text-dim" style="font-weight:400;font-size:12px;">${escapeHtml(domain)}</span></h4>
      <span class="dns-badge ${state}">${state === "loading" ? "Checking..." : state}</span>
    </div>
    <div class="dns-card-body">${state === "loading" ? '<div class="spinner-overlay"><div class="spinner"></div></div>' : ""}</div>
  `;
  return card;
}

function updateDnsCard(card, state, body) {
  const badge = card.querySelector(".dns-badge");
  const bodyEl = card.querySelector(".dns-card-body");
  badge.className = `dns-badge ${state}`;
  badge.textContent = state === "found" ? "Found" : state === "missing" ? "Not Found" : "Error";
  bodyEl.textContent = body;
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------
function setupSettingsPage() {
  setTimeoutSlider.addEventListener("input", () => {
    setTimeoutVal.textContent = setTimeoutSlider.value + "s";
    saveSettings();
  });

  setEncryption.addEventListener("change", () => saveSettings());

  $("#btn-add-profile").addEventListener("click", () => openProfileEditor(null));
  $("#btn-cancel-profile").addEventListener("click", closeProfileEditor);
  $("#btn-cancel-profile-2").addEventListener("click", closeProfileEditor);
  $("#btn-save-profile").addEventListener("click", saveProfileFromForm);

  $("#btn-export-settings").addEventListener("click", exportAllSettings);
  $("#btn-import-settings").addEventListener("click", importAllSettings);
}

// ---------------------------------------------------------------------------
// Profile Management
// ---------------------------------------------------------------------------
async function loadProfiles() {
  try {
    profiles = await invoke("list_profiles");
  } catch { profiles = []; }
  renderSidebarProfiles();
  renderSettingsProfiles();
}

function renderSidebarProfiles() {
  if (profiles.length === 0) {
    profileListEl.innerHTML = '<div class="profile-empty">No profiles yet</div>';
    return;
  }

  profileListEl.innerHTML = profiles.map((p) => `
    <div class="profile-item ${activeProfile === p.name ? 'active' : ''}" data-profile="${escapeHtml(p.name)}">
      <span class="profile-dot"></span>
      <span class="profile-name">${escapeHtml(p.name)}</span>
    </div>
  `).join("");

  profileListEl.querySelectorAll(".profile-item").forEach((el) => {
    el.addEventListener("click", () => activateProfile(el.dataset.profile));
  });
}

function renderSettingsProfiles() {
  const container = $("#settings-profile-list");
  if (profiles.length === 0) {
    container.innerHTML = '<p class="text-dim">No profiles configured.</p>';
    return;
  }

  container.innerHTML = profiles.map((p) => `
    <div class="settings-profile-item">
      <div class="settings-profile-info">
        <div class="settings-profile-name">${escapeHtml(p.name)}</div>
        <div class="settings-profile-detail">${escapeHtml(p.host)}:${p.port} (${escapeHtml(p.encryption)})${p.description ? ' - ' + escapeHtml(p.description) : ''}</div>
      </div>
      <div class="settings-profile-actions">
        <button class="btn-icon" onclick="editProfile('${escapeHtml(p.name)}')" title="Edit">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" onclick="removeProfile('${escapeHtml(p.name)}')" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join("");
}

function activateProfile(name) {
  const prof = profiles.find((p) => p.name === name);
  if (!prof) return;

  activeProfile = name;
  $("#host").value = prof.host;
  $("#port").value = prof.port;
  $("#encryption").value = prof.encryption;
  if (prof.username) $("#username").value = prof.username;
  saveFormState();
  renderSidebarProfiles();
  navigateTo("test");
  showToast(`Profile "${name}" loaded.`, "success");
}

function openProfileEditor(prof) {
  const editor = $("#profile-editor");
  $("#profile-editor-title").textContent = prof ? "Edit Profile" : "New Profile";
  $("#prof-name").value = prof ? prof.name : "";
  $("#prof-host").value = prof ? prof.host : "";
  $("#prof-port").value = prof ? prof.port : 587;
  $("#prof-encryption").value = prof ? prof.encryption : "starttls";
  $("#prof-username").value = prof ? prof.username : "";
  $("#prof-desc").value = prof ? prof.description : "";
  if (prof) $("#prof-name").dataset.original = prof.name;
  else delete $("#prof-name").dataset.original;
  editor.style.display = "";
}

function closeProfileEditor() {
  $("#profile-editor").style.display = "none";
}

async function saveProfileFromForm() {
  const name = $("#prof-name").value.trim();
  if (!name) { showToast("Profile name is required.", "warning"); return; }
  if (!$("#prof-host").value.trim()) { showToast("Host is required.", "warning"); return; }

  const profile = {
    name,
    host: $("#prof-host").value.trim(),
    port: parseInt($("#prof-port").value) || 587,
    encryption: $("#prof-encryption").value,
    username: $("#prof-username").value.trim(),
    description: $("#prof-desc").value.trim(),
    created_at: new Date().toISOString(),
  };

  // If renaming, delete old
  const original = $("#prof-name").dataset.original;
  if (original && original !== name) {
    try { await invoke("delete_profile", { name: original }); } catch { /* ignore */ }
  }

  try {
    await invoke("save_profile", { profile });
    await loadProfiles();
    closeProfileEditor();
    showToast("Profile saved.", "success");
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
}

window.editProfile = function (name) {
  const prof = profiles.find((p) => p.name === name);
  if (prof) openProfileEditor(prof);
};

window.removeProfile = async function (name) {
  try {
    await invoke("delete_profile", { name });
    if (activeProfile === name) activeProfile = null;
    await loadProfiles();
    showToast("Profile deleted.", "info");
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
};

// ---------------------------------------------------------------------------
// Settings Import / Export
// ---------------------------------------------------------------------------
function exportAllSettings() {
  const data = {
    version: "0.1.0",
    settings: {
      timeout: parseInt(setTimeoutSlider.value) || 30,
      encryption: setEncryption.value,
      theme: document.body.getAttribute("data-theme"),
    },
    templates,
    profiles,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `smtp-lab-settings-${dateSlug()}.json`);
  showToast("Settings exported.", "success");
}

function importAllSettings() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.settings) {
        if (data.settings.timeout) {
          setTimeoutSlider.value = data.settings.timeout;
          setTimeoutVal.textContent = data.settings.timeout + "s";
        }
        if (data.settings.encryption) setEncryption.value = data.settings.encryption;
        if (data.settings.theme) setTheme(data.settings.theme);
        saveSettings();
      }

      if (data.templates && Array.isArray(data.templates)) {
        templates = data.templates;
        saveTemplatesToStorage();
        renderTemplates();
      }

      if (data.profiles && Array.isArray(data.profiles)) {
        for (const p of data.profiles) {
          try { await invoke("save_profile", { profile: p }); } catch { /* skip */ }
        }
        await loadProfiles();
      }

      showToast("Settings imported successfully.", "success");
    } catch (err) {
      showToast("Failed to import settings: invalid file.", "error");
    }
  };
  input.click();
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------
function nowTs() {
  return new Date().toISOString().substr(11, 12);
}

function dateSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").substr(0, 19);
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function friendlyError(err) {
  const msg = String(err);
  if (msg.includes("Connection refused")) return "Could not connect to the SMTP server. Check the host and port.";
  if (msg.includes("timed out") || msg.includes("Timeout")) return "Connection timed out. The server may be unreachable.";
  if (msg.includes("certificate")) return "TLS certificate error. Try a different encryption mode.";
  if (msg.includes("authentication") || msg.includes("AUTH")) return "Authentication failed. Check your username and password.";
  return msg.length > 120 ? msg.substring(0, 120) + "..." : msg;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Initial render of templates
document.addEventListener("DOMContentLoaded", () => {
  renderTemplates();
});
