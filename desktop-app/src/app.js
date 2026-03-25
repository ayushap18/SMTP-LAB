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
let editingTemplate = null; // null = new, string = editing name

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

  try {
    const result = await invoke("smtp_test", { input });
    for (const entry of result.logs) addLogEntry(entry);

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
    setLoading(false);
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
    <tr>
      <td>${formatDate(h.timestamp)}</td>
      <td style="font-family:var(--font-mono);font-size:12px;">${escapeHtml(h.host)}:${h.port}</td>
      <td style="font-size:12px;">${escapeHtml(h.from)} &rarr; ${escapeHtml(h.to)}</td>
      <td><span class="status-badge ${h.success ? 'success' : 'error'}">${h.success ? 'Success' : 'Failed'}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px;">${h.elapsed_ms}ms</td>
      <td>
        <button class="expand-btn" data-index="${i}" onclick="toggleHistoryDetail(this, ${i})">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </td>
    </tr>
  `).join("");
}

window.toggleHistoryDetail = function (btn, index) {
  const tr = btn.closest("tr");
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains("history-detail-row")) {
    existing.remove();
    btn.classList.remove("expanded");
    return;
  }

  btn.classList.add("expanded");
  const h = historyData[index];
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
