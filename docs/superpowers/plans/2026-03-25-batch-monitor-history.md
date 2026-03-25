# Batch, Monitor & History Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully functional Batch testing tab, a real-time Monitor tab with Chart.js sparklines and desktop notifications, and fix two History page bugs — all in the SMTP Lab Tauri desktop app.

**Architecture:** Frontend is vanilla HTML/CSS/JS loaded as static files by Tauri. The Rust backend exposes Tauri commands via `invoke()`. Batch uses the existing `smtp_test` command per row with a JS concurrency queue (max 10). Monitor uses a new `smtp_ping` command (TCP+EHLO, no email). History fixes patch stale-data and index-mismatch bugs.

**Tech Stack:** Rust + Tauri v2, vanilla JS (ES2020), Chart.js 4.4.0 (bundled locally), CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-03-25-batch-monitor-history-design.md`

---

## File Map

| File | Role |
|------|------|
| `desktop-app/src-tauri/src/lib.rs` | Add `PingResult` struct + `smtp_ping` async command; register in `invoke_handler![]` |
| `desktop-app/src/chart.umd.min.js` | Bundled Chart.js 4.4.0 (downloaded, not written by hand) |
| `desktop-app/src/index.html` | Replace Batch/Monitor empty states with full markup; add Chart.js script tag |
| `desktop-app/src/app.js` | All JS: batch logic, monitor logic, history bug fixes |
| `desktop-app/src/styles.css` | New CSS: batch table, monitor cards grid, sparkline canvas, summary bar |

---

## Task 1: Download Chart.js and add to HTML

**Files:**
- Create: `desktop-app/src/chart.umd.min.js`
- Modify: `desktop-app/src/index.html`

- [ ] **Step 1: Download Chart.js 4.4.0 into the frontend assets folder**

The file **must** land in `desktop-app/src/` so Tauri serves it alongside `index.html`.

```bash
curl -L -o "/Users/ayush18/SMTP Lab/desktop-app/src/chart.umd.min.js" \
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
```
Expected: file ~210 KB created at `desktop-app/src/chart.umd.min.js`.

- [ ] **Step 2: Add script tag to index.html**

In `desktop-app/src/index.html`, find the closing lines:
```html
  <script src="app.js"></script>
</body>
```
Replace with:
```html
  <script src="chart.umd.min.js"></script>
  <script src="app.js"></script>
</body>
```
The `chart.umd.min.js` script **must come before** `app.js` so `window.Chart` is defined when `app.js` runs.

---

## Task 2: Fix History Bug 1 — Stale data after test run

**Files:**
- Modify: `desktop-app/src/app.js` (inside `runTest()`)

**Why `loadHistory()` not `refreshHistoryTable()`:** History entries are saved by the Rust backend during `smtp_test`. The JS in-memory `historyData` array does not include the new entry until it is fetched from the backend again. Therefore a full `await loadHistory()` (which calls `invoke("list_history")`) is required. The extra IPC call is negligible — test emails are not sent in rapid succession.

- [ ] **Step 1: Find runTest() finally block in app.js**

The `runTest()` function ends with:
```js
  } finally {
    setLoading(false);
  }
```

- [ ] **Step 2: Add loadHistory() call**

Change that `finally` block to:
```js
  } finally {
    setLoading(false);
    await loadHistory();
  }
```

- [ ] **Step 3: Manual verification**

Run a test from the Test tab. Navigate to History tab. The new entry should appear immediately without restarting.

---

## Task 3: Fix History Bug 2 — Wrong logs on filtered expand

**Files:**
- Modify: `desktop-app/src/app.js` (`loadHistory`, `refreshHistoryTable`, `toggleHistoryDetail`)

**Root cause:** `refreshHistoryTable()` maps the *filtered* array and passes position `i` to `toggleHistoryDetail`. When a search filter is active, `i` ≠ the position of that entry in `historyData`. Fix: use `h.id` (UUID string from Rust backend, always present) as the lookup key.

- [ ] **Step 1: Add migration guard in loadHistory()**

In `loadHistory()`, after the line `historyData = await invoke("list_history", { limit: 200 });`, add:
```js
// Defensive: assign ephemeral id to any old entry that somehow lacks one
historyData.forEach(h => { if (!h.id) h.id = crypto.randomUUID(); });
```

- [ ] **Step 2: Update refreshHistoryTable() row template**

Find the line inside `refreshHistoryTable()` that generates the `<tr>` and the expand button. It currently looks like:
```js
historyTbody.innerHTML = filtered.map((h, i) => `
  <tr>
    ...
    <button class="expand-btn" data-index="${i}" onclick="toggleHistoryDetail(this, ${i})">
```
Change to:
```js
historyTbody.innerHTML = filtered.map((h, i) => `
  <tr data-id="${h.id}">
    ...
    <button class="expand-btn" onclick="toggleHistoryDetail(this, '${h.id}')">
```

- [ ] **Step 3: Update toggleHistoryDetail to look up by id**

Find `window.toggleHistoryDetail = function (btn, index)`. Change the signature and lookup line:
```js
// BEFORE
window.toggleHistoryDetail = function (btn, index) {
  ...
  const h = historyData[index];

// AFTER
window.toggleHistoryDetail = function (btn, id) {
  ...
  const h = historyData.find(entry => entry.id === id);
  if (!h) return;
```
Leave the rest of the function body unchanged.

- [ ] **Step 4: Manual test**

Run 3 different tests. Go to History, type a host fragment in the search box to filter to 1 result. Click expand. Verify the logs shown match that specific run.

---

## Task 4: Add smtp_ping Rust backend command

**Files:**
- Modify: `desktop-app/src-tauri/src/lib.rs`

- [ ] **Step 1: Add use statements at top of lib.rs**

After the existing `use tauri::State;` line, add:
```rust
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::net::{Shutdown, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};
use tokio::task::spawn_blocking;
```
Note: `spawn_blocking` comes from `tokio` (already in Cargo.toml as a workspace dep with `features = ["full"]`). No Cargo.toml changes needed.

- [ ] **Step 2: Add PingResult struct**

After the `SmtpTestOutput` struct (around line 147 in the original file), add:
```rust
/// Result of a lightweight SMTP connectivity ping (no auth, no email).
#[derive(Debug, Serialize)]
pub struct PingResult {
    pub reachable: bool,
    pub latency_ms: u64,
    pub banner: String,
    pub error: Option<String>,
}
```

- [ ] **Step 3: Add smtp_ping command**

After the closing `}` of the `smtp_diagnose` function, add:
```rust
/// TCP + EHLO connectivity check. No auth, no email sent.
/// Timer: starts after connect, stops after reading EHLO response (excludes QUIT).
#[tauri::command]
async fn smtp_ping(host: String, port: u16) -> Result<PingResult, String> {
    spawn_blocking(move || {
        let addr_str = format!("{host}:{port}");
        let addr = match addr_str.to_socket_addrs() {
            Ok(mut iter) => match iter.next() {
                Some(a) => a,
                None => return PingResult {
                    reachable: false, latency_ms: 0,
                    banner: String::new(),
                    error: Some("Could not resolve hostname".into()),
                },
            },
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("DNS error: {e}")),
            },
        };

        let start = Instant::now();

        let stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
            Ok(s) => s,
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Connection failed: {e}")),
            },
        };

        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

        let mut reader = BufReader::new(match stream.try_clone() {
            Ok(s) => s,
            Err(e) => return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Stream clone error: {e}")),
            },
        });
        let mut stream_w = stream;

        // Read SMTP banner
        let mut banner = String::new();
        if let Err(e) = reader.read_line(&mut banner) {
            return PingResult {
                reachable: false, latency_ms: 0,
                banner: String::new(),
                error: Some(format!("Banner read error: {e}")),
            };
        }

        // Send EHLO
        if let Err(e) = stream_w.write_all(b"EHLO smtplab\r\n") {
            return PingResult {
                reachable: false, latency_ms: 0,
                banner: banner.trim().to_string(),
                error: Some(format!("EHLO write error: {e}")),
            };
        }

        // Read EHLO response (SMTP multi-line: lines starting with "250-" continue, "250 " is last)
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).is_err() { break; }
            if line.len() >= 4 && &line[3..4] == " " { break; }
            if line.len() < 4 { break; }
        }

        // Stop timer here (before QUIT — latency covers connect + banner + EHLO)
        let latency_ms = start.elapsed().as_millis() as u64;

        // Clean disconnect
        let _ = stream_w.write_all(b"QUIT\r\n");
        let _ = stream_w.shutdown(Shutdown::Both);

        PingResult {
            reachable: true,
            latency_ms,
            banner: banner.trim().to_string(),
            error: None,
        }
    })
    .await
    .map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Register smtp_ping in invoke_handler**

Find `tauri::generate_handler![` in the `run()` function. Add `smtp_ping`:
```rust
.invoke_handler(tauri::generate_handler![
    smtp_test,
    smtp_diagnose,
    smtp_ping,        // ← add this line
    list_profiles,
    save_profile,
    delete_profile,
    list_history,
    clear_history,
    dns_mx_lookup,
    dns_check_spf,
    dns_check_dkim,
    dns_check_dmarc,
    get_logs,
    export_logs,
])
```

- [ ] **Step 5: Build and verify**

```bash
cd "/Users/ayush18/SMTP Lab"
source "$HOME/.cargo/env" && cargo build 2>&1 | grep -E "^error|Finished"
```
Expected: `Finished` line, no `^error` lines.

---

## Task 5: Batch tab — HTML markup

**Files:**
- Modify: `desktop-app/src/index.html`

- [ ] **Step 1: Replace Batch empty state**

Find and replace the entire `<div class="tab-content" id="tab-test-batch">` block (currently the "Coming soon" block) with:

```html
<div class="tab-content" id="tab-test-batch">
  <div class="batch-toolbar">
    <button id="btn-batch-add" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Row
    </button>
    <button id="btn-batch-run" class="btn btn-primary btn-sm">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Run All
    </button>
    <button id="btn-batch-clear" class="btn btn-secondary btn-sm">Clear</button>
    <div class="btn-dropdown">
      <button id="btn-batch-export" class="btn btn-secondary btn-sm">Export ▾</button>
      <div id="batch-export-menu" class="dropdown-menu" style="display:none;">
        <button id="btn-batch-export-csv">Export CSV</button>
        <button id="btn-batch-export-json">Export JSON</button>
      </div>
    </div>
  </div>

  <div class="batch-table-wrap">
    <table class="data-table batch-table" id="batch-table" style="display:none;">
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Host</th>
          <th style="width:70px">Port</th>
          <th style="width:100px">Enc</th>
          <th>Username</th>
          <th>Password</th>
          <th>From</th>
          <th>To</th>
          <th>Subject</th>
          <th style="width:80px">Status</th>
          <th style="width:70px">Latency</th>
          <th style="width:36px"></th>
        </tr>
      </thead>
      <tbody id="batch-tbody"></tbody>
    </table>
    <div id="batch-empty" class="empty-state">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8l-2 4h12z"/></svg>
      <h3>No Batch Jobs</h3>
      <p>Click <strong>Add Row</strong> to add SMTP jobs, then <strong>Run All</strong> to test them in parallel.</p>
    </div>
  </div>

  <div id="batch-summary" class="batch-summary" style="display:none;">
    <span>Total: <strong id="bs-total">0</strong></span>
    <span class="bs-sep">|</span>
    <span class="bs-passed">Passed: <strong id="bs-passed">0</strong></span>
    <span class="bs-sep">|</span>
    <span class="bs-failed">Failed: <strong id="bs-failed">0</strong></span>
    <span class="bs-sep">|</span>
    <span>Avg Latency: <strong id="bs-avg">—</strong></span>
  </div>
</div>
```

---

## Task 6: Monitor tab — HTML markup

**Files:**
- Modify: `desktop-app/src/index.html`

- [ ] **Step 1: Replace Monitor empty state**

Find and replace the entire `<div class="tab-content" id="tab-test-monitor">` block with:

```html
<div class="tab-content" id="tab-test-monitor">
  <div class="monitor-toolbar">
    <button id="btn-monitor-add" class="btn btn-secondary btn-sm">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Server
    </button>
    <label class="toolbar-label">Interval:</label>
    <select id="monitor-interval" class="select-sm">
      <option value="30000">30s</option>
      <option value="60000" selected>1m</option>
      <option value="300000">5m</option>
      <option value="600000">10m</option>
    </select>
    <button id="btn-monitor-start-all" class="btn btn-primary btn-sm">Start All</button>
    <button id="btn-monitor-stop-all" class="btn btn-secondary btn-sm">Stop All</button>
  </div>

  <div id="monitor-grid" class="monitor-grid">
    <div id="monitor-empty" class="empty-state" style="grid-column:1/-1;">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <h3>No Servers</h3>
      <p>Click <strong>Add Server</strong> to monitor SMTP server connectivity over time.</p>
    </div>
  </div>

  <!-- Add Server modal -->
  <div id="monitor-add-modal" class="modal-overlay" style="display:none;">
    <div class="modal-card">
      <div class="card-header">
        <h3>Add Server</h3>
        <button id="btn-monitor-modal-close" class="btn-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="form-group">
        <label for="mon-name">Name</label>
        <input type="text" id="mon-name" placeholder="e.g. Gmail SMTP" />
      </div>
      <div class="form-row">
        <div class="form-group flex-2">
          <label for="mon-host">Host</label>
          <input type="text" id="mon-host" placeholder="smtp.gmail.com" spellcheck="false" />
        </div>
        <div class="form-group flex-1">
          <label for="mon-port">Port</label>
          <input type="number" id="mon-port" value="587" />
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-monitor-modal-save" class="btn btn-primary">Add Server</button>
        <button id="btn-monitor-modal-cancel" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</div>
```

---

## Task 7: CSS — Batch, Monitor, Modal

**Files:**
- Modify: `desktop-app/src/styles.css`

- [ ] **Step 1: Append all new CSS at the end of styles.css**

```css
/* ================================================================
   BATCH
   ================================================================ */
.batch-toolbar {
  display: flex; gap: 8px; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border); flex-wrap: wrap;
}
.btn-dropdown { position: relative; }
.dropdown-menu {
  position: absolute; top: calc(100% + 4px); left: 0;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; min-width: 140px; z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,.25);
}
.dropdown-menu button {
  display: block; width: 100%; padding: 8px 14px;
  background: none; border: none; color: var(--text);
  font-size: 13px; text-align: left; cursor: pointer;
}
.dropdown-menu button:hover { background: var(--surface-hover); }
.batch-table-wrap { flex: 1; overflow: auto; padding: 0 16px 16px; }
.batch-table td { padding: 4px 6px; vertical-align: middle; }
.batch-table td input,
.batch-table td select {
  width: 100%; padding: 4px 6px;
  background: var(--input-bg); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text);
  font-size: 12px; font-family: var(--font-mono);
}
.batch-table td input:focus,
.batch-table td select:focus { outline: none; border-color: var(--accent); }
.batch-status-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; background: var(--text-dim); vertical-align: middle;
}
.batch-status-dot.running { background: var(--accent); animation: pulse 1s infinite; }
.batch-status-dot.success { background: var(--success, #22c55e); }
.batch-status-dot.failed  { background: var(--error,   #ef4444); }
.batch-summary {
  display: flex; gap: 12px; align-items: center;
  padding: 10px 16px; border-top: 1px solid var(--border);
  font-size: 13px; flex-wrap: wrap;
}
.bs-sep { color: var(--text-dim); }
.bs-passed strong { color: var(--success, #22c55e); }
.bs-failed strong  { color: var(--error,   #ef4444); }
.batch-detail-row td {
  padding: 8px 16px !important;
  background: var(--surface-2);
}

/* ================================================================
   MONITOR
   ================================================================ */
.monitor-toolbar {
  display: flex; gap: 8px; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border); flex-wrap: wrap;
}
.toolbar-label { font-size: 13px; color: var(--text-dim); }
.select-sm {
  padding: 5px 8px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--input-bg);
  color: var(--text); font-size: 13px;
}
.monitor-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px; padding: 16px; overflow-y: auto;
}
@media (max-width: 700px) { .monitor-grid { grid-template-columns: 1fr; } }
.monitor-card {
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; cursor: pointer;
  transition: border-color .15s;
}
.monitor-card:hover { border-color: var(--accent); }
.monitor-card-header {
  display: flex; justify-content: space-between;
  align-items: flex-start; margin-bottom: 10px;
}
.monitor-card-name  { font-weight: 600; font-size: 14px; }
.monitor-card-host  { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); }
.monitor-badge {
  font-size: 11px; font-weight: 700;
  padding: 3px 8px; border-radius: 4px; letter-spacing: .5px;
  white-space: nowrap;
}
.monitor-badge.reachable { background: rgba(34,197,94,.15);  color: #22c55e; }
.monitor-badge.down      { background: rgba(239,68,68,.15);  color: #ef4444; }
.monitor-badge.slow      { background: rgba(234,179,8,.15);  color: #eab308; }
.monitor-badge.checking,
.monitor-badge.idle      { background: var(--surface-3, #2a2a2a); color: var(--text-dim); }
.monitor-card-stats {
  display: flex; justify-content: space-between;
  font-size: 12px; color: var(--text-dim); margin-bottom: 8px;
}
.monitor-sparkline-wrap { margin-bottom: 8px; height: 40px; line-height: 40px; }
.chart-unavailable { font-size: 11px; color: var(--text-dim); }
.monitor-card-footer {
  display: flex; justify-content: space-between; align-items: center;
}
.monitor-last-checked { font-size: 11px; color: var(--text-dim); }
.monitor-card-controls { display: flex; gap: 6px; }
.monitor-detail-panel {
  margin-top: 10px; border-top: 1px solid var(--border);
  padding-top: 10px; max-height: 200px; overflow-y: auto;
}
.monitor-detail-row {
  display: flex; gap: 10px; font-size: 11px;
  font-family: var(--font-mono); padding: 2px 0;
}
.monitor-detail-row .mdr-time   { color: var(--text-dim); min-width: 80px; }
.monitor-detail-row .mdr-ms     { min-width: 60px; }
.monitor-detail-row .mdr-status.reachable { color: #22c55e; }
.monitor-detail-row .mdr-status.down      { color: #ef4444; }
.monitor-detail-row .mdr-status.slow      { color: #eab308; }

/* ================================================================
   MODAL
   ================================================================ */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal-card {
  background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
  min-width: 340px; max-width: 480px; width: 90%;
}
```

---

## Task 8: Batch JS logic

**Files:**
- Modify: `desktop-app/src/app.js`

- [ ] **Step 1: Add batch state variables**

After the line `let activeProfile = null;` (in the State section near the top of app.js), add:
```js
// Batch
let batchRows    = [];
let batchRunning = false;
```

- [ ] **Step 2: Wire setupBatchPage() into the existing DOMContentLoaded handler**

The existing handler is at **line 61** of `app.js`. It currently ends with:
```js
  await loadProfiles();
  await loadHistory();
});
```
Change it to:
```js
  setupBatchPage();
  setupMonitorPage();
  await loadProfiles();
  await loadHistory();
});
```
Both `setupBatchPage` and `setupMonitorPage` **must** be added to this one handler. Do **not** create a new `addEventListener("DOMContentLoaded", ...)` block.

- [ ] **Step 3: Add all batch functions**

Add the following block **after** the `setupHistoryPage()` function (search for `// ---------------------------------------------------------------------------\n// History Page`):

```js
// ---------------------------------------------------------------------------
// Batch Page
// ---------------------------------------------------------------------------
function setupBatchPage() {
  $("#btn-batch-add").addEventListener("click", addBatchRow);
  $("#btn-batch-run").addEventListener("click", runBatch);
  $("#btn-batch-clear").addEventListener("click", clearBatch);

  // Export dropdown toggle
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
    status: "idle", result: null,
  });
  renderBatchTable();
}

function clearBatch() {
  batchRows = [];
  batchRunning = false;
  renderBatchTable();
  $("#batch-summary").style.display = "none";
}

function renderBatchTable() {
  const tbody  = $("#batch-tbody");
  const empty  = $("#batch-empty");
  const table  = $("#batch-table");
  if (batchRows.length === 0) {
    tbody.innerHTML = "";
    empty.style.display  = "";
    table.style.display  = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "";

  tbody.innerHTML = batchRows.map((r, i) => `
    <tr data-batch-id="${r.id}">
      <td style="color:var(--text-dim);font-size:12px;text-align:center;">${i + 1}</td>
      <td><input type="text"     class="bi-host"    value="${escapeHtml(r.host)}"    placeholder="smtp.example.com" /></td>
      <td><input type="number"   class="bi-port"    value="${r.port}" /></td>
      <td>
        <select class="bi-enc">
          <option value="starttls" ${r.enc === "starttls" ? "selected" : ""}>STARTTLS</option>
          <option value="ssl"      ${r.enc === "ssl"      ? "selected" : ""}>SSL</option>
          <option value="none"     ${r.enc === "none"     ? "selected" : ""}>None</option>
        </select>
      </td>
      <td><input type="text"     class="bi-user"    value="${escapeHtml(r.user)}"    placeholder="user@example.com" /></td>
      <td><input type="password" class="bi-pass"    value="${escapeHtml(r.pass)}"    placeholder="password" /></td>
      <td><input type="email"    class="bi-from"    value="${escapeHtml(r.from)}"    placeholder="from@example.com" /></td>
      <td><input type="email"    class="bi-to"      value="${escapeHtml(r.to)}"      placeholder="to@example.com" /></td>
      <td><input type="text"     class="bi-subject" value="${escapeHtml(r.subject)}" placeholder="Subject" /></td>
      <td style="text-align:center;" class="batch-status-cell">
        <span class="batch-status-dot"></span>
      </td>
      <td style="font-family:var(--font-mono);font-size:12px;text-align:right;" class="batch-latency-cell">—</td>
      <td>
        <button class="expand-btn" onclick="toggleBatchDetail(this, '${r.id}')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </td>
    </tr>
  `).join("");

  // Sync input changes back to batchRows array
  tbody.querySelectorAll("tr[data-batch-id]").forEach((tr) => {
    const rowId = tr.dataset.batchId;
    const row = batchRows.find(r => r.id === rowId);
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

window.toggleBatchDetail = function(btn, id) {
  const tr = btn.closest("tr");
  const existing = tr.nextElementSibling;
  if (existing && existing.classList.contains("batch-detail-row")) {
    existing.remove();
    btn.classList.remove("expanded");
    return;
  }
  btn.classList.add("expanded");
  const row = batchRows.find(r => r.id === id);
  if (!row) return;
  const detailTr = document.createElement("tr");
  detailTr.className = "batch-detail-row";
  const td = document.createElement("td");
  td.colSpan = 12;
  const logs = row.result?.logs || [];
  let html = '<div class="log-container" style="max-height:160px;">';
  if (logs.length > 0) {
    for (const e of logs) {
      const code = e.smtp_code ? `<span class="log-code">${e.smtp_code}</span>` : "";
      html += `<div class="log-entry ${levelClass(e.level)}">
        <span class="log-time">${e.timestamp}</span>
        <span class="log-level">${levelLabel(e.level)}</span>
        <span class="log-stage">${e.stage}</span>${code}
        <span class="log-msg">${escapeHtml(e.message)}</span>
      </div>`;
    }
  } else {
    html += `<div class="text-dim" style="padding:8px;">${escapeHtml(row.result?.error || row.result?.message || "No logs.")}</div>`;
  }
  html += "</div>";
  td.innerHTML = html;
  detailTr.appendChild(td);
  tr.after(detailTr);
};

function syncBatchRowsFromDom() {
  $("#batch-tbody").querySelectorAll("tr[data-batch-id]").forEach(tr => {
    const rowId = tr.dataset.batchId;
    const row = batchRows.find(r => r.id === rowId);
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

async function runBatch() {
  if (batchRunning) return;
  if (batchRows.length === 0) { showToast("Add at least one row.", "warning"); return; }

  syncBatchRowsFromDom();

  // Reset all rows to idle
  batchRows.forEach(r => { r.status = "idle"; r.result = null; });
  renderBatchTable();
  $("#batch-summary").style.display = "none";
  batchRunning = true;

  await runWithConcurrency(batchRows, 10, async (row) => {
    row.status = "running";
    updateBatchRowStatus(row);

    if (!row.host || !row.from || !row.to) {
      row.status = "skipped";
      row.result = {
        success: false, error: "Missing required fields (host, from, to)",
        message: "Missing required fields (host, from, to)", logs: [], elapsed_ms: 0,
      };
      updateBatchRowStatus(row);
      return;
    }

    const input = {
      host: row.host, port: row.port, encryption: row.enc,
      username: row.user, password: row.pass,
      from: row.from, to: row.to, subject: row.subject,
      body: "SMTP Lab batch test", html_body: null, timeout_secs: 30,
    };

    try {
      const result = await invoke("smtp_test", { input });
      row.status = result.success ? "success" : "failed";
      row.result = result;
    } catch (err) {
      const msg = typeof err === "string" ? err : JSON.stringify(err);
      row.status = "failed";
      row.result = { success: false, message: msg, error: msg, logs: [], elapsed_ms: 0 };
    }
    updateBatchRowStatus(row);
  });

  batchRunning = false;
  showBatchSummary();
}

function updateBatchRowStatus(row) {
  const tr = $("#batch-tbody").querySelector(`tr[data-batch-id="${row.id}"]`);
  if (!tr) return;
  const statusCell  = tr.querySelector(".batch-status-cell");
  const latencyCell = tr.querySelector(".batch-latency-cell");

  if (statusCell) {
    if (row.status === "idle")    statusCell.innerHTML = '<span class="batch-status-dot"></span>';
    if (row.status === "running") statusCell.innerHTML = '<span class="batch-status-dot running"></span>';
    if (row.status === "success") statusCell.innerHTML = '<span class="status-badge success" style="font-size:11px;">OK</span>';
    if (row.status === "failed")  statusCell.innerHTML = `<span class="status-badge error" style="font-size:11px;" title="${escapeHtml(row.result?.error || row.result?.message || "")}">FAIL</span>`;
    if (row.status === "skipped") statusCell.innerHTML = '<span class="status-badge" style="font-size:11px;background:var(--surface-3,#333);">SKIP</span>';
  }
  if (latencyCell) {
    latencyCell.textContent = row.result?.elapsed_ms != null ? row.result.elapsed_ms + "ms" : "—";
  }
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
```

---

## Task 9: Monitor JS logic

**Files:**
- Modify: `desktop-app/src/app.js`

- [ ] **Step 1: Add monitor state variables**

After `let batchRunning = false;` (added in Task 8), add:
```js
// Monitor
let monitorServers     = [];
let notificationsDenied = false;
let relativeTimeTicker  = null;
```

- [ ] **Step 2: Add all monitor functions**

Add the following block **after** the batch functions:

```js
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
  const intervalMs = parseInt($("#monitor-interval").value) || 60000;
  const saved = { id: crypto.randomUUID(), name, host, port, interval_ms: intervalMs };
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
  const toSave = monitorServers.map(({ id, name, host, port, interval_ms }) =>
    ({ id, name, host, port, interval_ms }));
  localStorage.setItem("smtplab-monitor-servers", JSON.stringify(toSave));
}

function renderMonitorGrid() {
  const grid  = $("#monitor-grid");
  const empty = $("#monitor-empty");

  // Remove stale cards
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
  card.innerHTML = `
    <div class="monitor-card-header" onclick="toggleMonitorDetail('${srv.id}')">
      <div>
        <div class="monitor-card-name">${escapeHtml(srv.name)}</div>
        <div class="monitor-card-host">${escapeHtml(srv.host)}:${srv.port}</div>
      </div>
      <span class="monitor-badge idle" data-badge>IDLE</span>
    </div>
    <div class="monitor-card-stats">
      <span data-last-ms>— ms</span>
      <span data-uptime>Uptime: —</span>
    </div>
    <div class="monitor-sparkline-wrap" data-sparkwrap>
      ${window.Chart
        ? `<canvas width="120" height="40" data-spark></canvas>`
        : `<span class="chart-unavailable">(chart unavailable)</span>`}
    </div>
    <div class="monitor-card-footer">
      <span class="monitor-last-checked" data-last-checked>Never checked</span>
      <div class="monitor-card-controls" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" style="padding:3px 10px;font-size:11px;"
          data-toggle-btn onclick="toggleMonitorServer('${srv.id}')">Start</button>
        <button class="btn-icon" title="Delete" onclick="deleteMonitorServer('${srv.id}')">
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
    srv.sparkChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: Array(20).fill(""),
        datasets: [{
          data: [], borderColor: "#6366f1", borderWidth: 1.5,
          tension: 0.4, fill: false, pointRadius: 0,
        }],
      },
      options: {
        responsive: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
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
    badge.className = `monitor-badge ${srv.status === "idle" ? "idle" : srv.status}`;
    badge.textContent = ({ idle:"IDLE", checking:"CHECKING", reachable:"REACHABLE", down:"DOWN", slow:"SLOW" })[srv.status] || srv.status.toUpperCase();
  }
  const lastMsEl = card.querySelector("[data-last-ms]");
  if (lastMsEl) lastMsEl.textContent = srv.lastMs != null ? srv.lastMs + " ms" : "— ms";

  const uptimeEl = card.querySelector("[data-uptime]");
  if (uptimeEl) {
    const pct = srv.checks.total > 0
      ? (srv.checks.ok / srv.checks.total * 100).toFixed(1) : null;
    uptimeEl.textContent = pct != null ? `Uptime: ${pct}%` : "Uptime: —";
  }

  const toggleBtn = card.querySelector("[data-toggle-btn]");
  if (toggleBtn) toggleBtn.textContent = srv.timer ? "Stop" : "Start";

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
  pingServer(srv); // immediate first ping
  srv.timer = setInterval(() => pingServer(srv), srv.interval_ms);
  updateMonitorCard(srv);
}

function stopMonitorServer(srv) {
  if (srv.timer) { clearInterval(srv.timer); srv.timer = null; }
  updateMonitorCard(srv);
}

async function pingServer(srv) {
  const prevStatus = srv.status === "checking" ? (srv.lastMs != null ? (srv.lastMs >= 2000 ? "slow" : "reachable") : "idle") : srv.status;
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
```

---

## Task 10: Final build and smoke test

**Files:**
- `desktop-app/src-tauri/src/lib.rs` (verify compile)

- [ ] **Step 1: Build Rust backend**

```bash
cd "/Users/ayush18/SMTP Lab"
source "$HOME/.cargo/env" && cargo build 2>&1 | grep -E "^error|Finished"
```
Expected: one `Finished` line, zero `^error` lines.

- [ ] **Step 2: Launch the app**

```bash
source "$HOME/.cargo/env" && cd "/Users/ayush18/SMTP Lab" && cargo tauri dev
```

- [ ] **Step 3: Smoke test checklist**

| Feature | Check |
|---------|-------|
| History: new entry | Run a test → navigate to History → entry appears without restart |
| History: expand filter | Search for a host, expand a filtered row → logs match that row's host |
| Batch: add rows | Click Add Row 3× → rows appear with input cells |
| Batch: validation | Leave Host empty on one row, click Run All → that row shows SKIP |
| Batch: run | Fill Ethereal credentials, Run All → OK/FAIL badges appear, summary bar shows |
| Batch: export CSV | Click Export → CSV → file downloads |
| Monitor: add server | Click Add Server → smtp.ethereal.email:587 → card appears in grid |
| Monitor: start | Click Start on card → badge changes to CHECKING then REACHABLE, sparkline plots |
| Monitor: stop | Click Stop → interval stops, relative time freezes |
| Monitor: delete | Click delete icon → card removed |

- [ ] **Step 4: Commit**

```bash
cd "/Users/ayush18/SMTP Lab"
git add desktop-app/src/ desktop-app/src-tauri/src/lib.rs docs/
git commit -m "feat: implement Batch tab, Monitor tab, fix History bugs

- Batch: parallel job runner (max 10 concurrent), per-row log drawers, CSV/JSON export
- Monitor: real-time SMTP ping, Chart.js sparklines, desktop notifications on state change
- History: fix stale data after test run (reload from backend), fix index mismatch on filtered expand
- Backend: add smtp_ping command (TCP+EHLO connectivity check, no auth)"
```
