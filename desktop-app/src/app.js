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
let activeTemplateFilter = "all";

// Monitor
let monitorServers      = [];
let notificationsDenied = false;
let relativeTimeTicker  = null;

// ---------------------------------------------------------------------------
// Built-in Templates
// ---------------------------------------------------------------------------
const BUILTIN_TEMPLATES = [
  // ── Level 1: Basic ─────────────────────────────────────────────────────
  {
    name: "Plain Text Ping",
    category: "basic",
    description: "Minimal connectivity test. Use to verify SMTP is reachable.",
    builtin: true,
    from: "", to: "",
    subject: "SMTP Connectivity Test",
    body: `Hello,\n\nThis is an automated connectivity test sent by SMTP Lab.\n\nIf you received this email, your SMTP server is working correctly.\n\nTimestamp: {{timestamp}}\n\n— SMTP Lab`,
    html_body: null,
  },
  {
    name: "Delivery Echo",
    category: "basic",
    description: "Ask the recipient to reply, confirming end-to-end delivery.",
    builtin: true,
    from: "", to: "",
    subject: "Delivery Verification — Please Reply",
    body: `Hi,\n\nThis is a delivery verification email. If you received this, please reply with "Received" so we can confirm end-to-end delivery.\n\nSent at: {{timestamp}}\nServer tested: {{host}}\n\nThank you,\nSMTP Lab Diagnostics`,
    html_body: null,
  },

  // ── Level 2: Transactional ─────────────────────────────────────────────
  {
    name: "Welcome Email",
    category: "transactional",
    description: "New-user welcome with onboarding steps and help link.",
    builtin: true,
    from: "", to: "",
    subject: "Welcome to {{AppName}} — Let's get started",
    body: `Hi {{FirstName}},\n\nWelcome aboard! We're thrilled to have you.\n\nHere's what you can do next:\n\n  1. Complete your profile at https://app.example.com/profile\n  2. Explore the dashboard at https://app.example.com/dashboard\n  3. Invite your team at https://app.example.com/team\n\nIf you have any questions, reply to this email or visit our help centre at https://help.example.com.\n\nCheers,\nThe {{AppName}} Team\n\n---\nYou received this email because you signed up at example.com.\nUnsubscribe: https://example.com/unsubscribe`,
    html_body: null,
  },
  {
    name: "Password Reset",
    category: "transactional",
    description: "Password reset with 30-minute expiry link placeholder.",
    builtin: true,
    from: "", to: "",
    subject: "Reset your password",
    body: `Hi {{FirstName}},\n\nWe received a request to reset the password for your account associated with this email address.\n\nClick the link below to reset your password (valid for 30 minutes):\n\n  https://app.example.com/reset?token=REPLACE_WITH_TOKEN\n\nIf you did not request a password reset, please ignore this email. Your password will not change.\n\n— The {{AppName}} Security Team`,
    html_body: null,
  },
  {
    name: "Order Confirmation",
    category: "transactional",
    description: "Structured order summary with line items, totals, and tracking link.",
    builtin: true,
    from: "", to: "",
    subject: "Order #{{OrderID}} confirmed — Thank you!",
    body: `Hi {{FirstName}},\n\nThank you for your order! Here's a summary:\n\nORDER #{{OrderID}}\n─────────────────────────────────────\nProduct                  Qty    Price\n─────────────────────────────────────\nPremium Plan (Annual)      1   $99.00\nSetup Fee                  1   $19.00\n─────────────────────────────────────\nSubtotal                        $118.00\nTax (8%)                          $9.44\nTOTAL                           $127.44\n─────────────────────────────────────\n\nPayment method: Visa ending 4242\n\nTrack your order: https://example.com/orders/{{OrderID}}\n\n— The {{AppName}} Team`,
    html_body: null,
  },
  {
    name: "Shipping Notification",
    category: "transactional",
    description: "Package shipped alert with carrier, tracking number, and ETA.",
    builtin: true,
    from: "", to: "",
    subject: "Your order #{{OrderID}} has shipped",
    body: `Hi {{FirstName}},\n\nGreat news — your order is on its way!\n\nTRACKING DETAILS\n────────────────\nCarrier:         FedEx\nTracking number: {{TrackingNumber}}\nEstimated delivery: {{DeliveryDate}}\n\nTrack: https://fedex.com/track?id={{TrackingNumber}}\n\nIf you have any questions, contact us at support@example.com.\n\n— {{AppName}} Fulfilment Team`,
    html_body: null,
  },
  {
    name: "Invoice",
    category: "transactional",
    description: "Formal invoice with line items, subtotal, tax, payment instructions.",
    builtin: true,
    from: "", to: "",
    subject: "Invoice #{{InvoiceID}} from {{AppName}} — Due {{DueDate}}",
    body: `INVOICE #{{InvoiceID}}\n══════════════════════════════════════════\nFrom:   {{AppName}}, 1 Market St, SF CA 94105\nTo:     {{ClientName}}, {{ClientAddress}}\nDate:   {{InvoiceDate}}\nDue:    {{DueDate}}\n\nITEMS\n──────────────────────────────────────────\nDescription               Hours    Amount\n──────────────────────────────────────────\nSoftware Development        40    $4,000.00\nUI/UX Design                 8      $800.00\nCode Review                  4      $400.00\n──────────────────────────────────────────\nSubtotal                          $5,200.00\nTax (10%)                           $520.00\nAMOUNT DUE                        $5,720.00\n──────────────────────────────────────────\n\nPayment: Bank transfer to Account 123456789\nReference: INV-{{InvoiceID}}\n\nThank you for your business!\n{{AppName}} Accounts — accounts@example.com`,
    html_body: null,
  },
  {
    name: "Account Verification",
    category: "transactional",
    description: "Email verification with OTP code and fallback link.",
    builtin: true,
    from: "", to: "",
    subject: "Verify your email address",
    body: `Hi {{FirstName}},\n\nThanks for signing up! Please verify your email address to activate your account.\n\nYour verification code:\n\n    ██████████\n    {{OTPCode}}\n    ██████████\n\nOr click the link below (valid for 24 hours):\nhttps://app.example.com/verify?token={{VerifyToken}}\n\nIf you didn't create an account, you can safely ignore this email.\n\n— The {{AppName}} Team`,
    html_body: null,
  },

  // ── Level 3: HTML ──────────────────────────────────────────────────────
  {
    name: "HTML Welcome Email",
    category: "html",
    description: "Fully branded HTML welcome email with CTA button and feature highlights.",
    builtin: true,
    from: "", to: "",
    subject: "Welcome to {{AppName}} — You're in! 🎉",
    body: `Welcome to {{AppName}}!\n\nHi {{FirstName}}, your account is ready.\n\nGet started: https://app.example.com/dashboard\n\n— The {{AppName}} Team`,
    html_body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome</title></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Welcome to {{AppName}} 🎉</h1>
          <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:16px;">Your account is ready. Let's get started.</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">Hi <strong>{{FirstName}}</strong>,</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 32px;">We're thrilled to have you on board. Here's a quick overview of what you can do:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td width="48" valign="top" style="padding-right:16px;padding-bottom:20px;">
                <div style="width:40px;height:40px;background:#ede9fe;border-radius:10px;text-align:center;line-height:40px;font-size:20px;">⚡</div>
              </td>
              <td valign="top" style="padding-bottom:20px;">
                <strong style="color:#111827;font-size:15px;">Fast Setup</strong>
                <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Get running in minutes with our guided onboarding.</p>
              </td>
            </tr>
            <tr>
              <td width="48" valign="top" style="padding-right:16px;padding-bottom:20px;">
                <div style="width:40px;height:40px;background:#dcfce7;border-radius:10px;text-align:center;line-height:40px;font-size:20px;">🔒</div>
              </td>
              <td valign="top" style="padding-bottom:20px;">
                <strong style="color:#111827;font-size:15px;">Enterprise Security</strong>
                <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">SOC 2 compliant with end-to-end encryption.</p>
              </td>
            </tr>
            <tr>
              <td width="48" valign="top" style="padding-right:16px;">
                <div style="width:40px;height:40px;background:#fef3c7;border-radius:10px;text-align:center;line-height:40px;font-size:20px;">📊</div>
              </td>
              <td valign="top">
                <strong style="color:#111827;font-size:15px;">Real-time Analytics</strong>
                <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Track usage, performance, and trends at a glance.</p>
              </td>
            </tr>
          </table>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="https://app.example.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">Go to Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">You received this email because you signed up at example.com.<br>
          <a href="https://example.com/unsubscribe" style="color:#9ca3af;">Unsubscribe</a> · <a href="https://example.com/privacy" style="color:#9ca3af;">Privacy Policy</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    name: "HTML Newsletter",
    category: "html",
    description: "Monthly digest newsletter with header, two article blocks, and footer.",
    builtin: true,
    from: "", to: "",
    subject: "{{AppName}} Monthly Digest — {{Month}} {{Year}}",
    body: `{{AppName}} Monthly Digest\n\nHi {{FirstName}},\n\nHere's what happened this month:\n\n1. NEW FEATURE: Dark mode is now available\n   Read more: https://blog.example.com/dark-mode\n\n2. PERFORMANCE: 40% faster load times\n   Read more: https://blog.example.com/performance\n\nSee everything: https://blog.example.com\n\n— The {{AppName}} Team\nUnsubscribe: https://example.com/unsubscribe`,
    html_body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Newsletter</title></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:#111827;padding:28px 40px;text-align:center;">
          <span style="color:#ffffff;font-size:22px;font-weight:700;">{{AppName}}</span>
          <span style="color:#6b7280;font-size:14px;display:block;margin-top:4px;">Monthly Digest · {{Month}} {{Year}}</span>
        </td></tr>
        <tr><td style="padding:32px 40px 0;">
          <p style="color:#374151;font-size:16px;margin:0 0 28px;">Hi <strong>{{FirstName}}</strong>, here's what happened this month 👇</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#ede9fe;padding:20px 24px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;">New Feature</span>
              <h2 style="color:#111827;font-size:18px;margin:8px 0 4px;">Dark Mode is Here 🌙</h2>
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">We heard your feedback loud and clear. Dark mode is now available across all screens.</p>
              <a href="https://blog.example.com/dark-mode" style="color:#7c3aed;font-size:14px;font-weight:600;text-decoration:none;">Read more →</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#dcfce7;padding:20px 24px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">Performance</span>
              <h2 style="color:#111827;font-size:18px;margin:8px 0 4px;">40% Faster Load Times ⚡</h2>
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">Our infrastructure upgrade is complete. Pages now load 40% faster on average.</p>
              <a href="https://blog.example.com/performance" style="color:#16a34a;font-size:14px;font-weight:600;text-decoration:none;">Read more →</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td align="center">
            <a href="https://blog.example.com" style="display:inline-block;border:2px solid #374151;color:#374151;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">View all updates</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© 2026 {{AppName}} · <a href="https://example.com/unsubscribe" style="color:#9ca3af;">Unsubscribe</a> · <a href="https://example.com/privacy" style="color:#9ca3af;">Privacy</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    name: "HTML Promotional",
    category: "html",
    description: "Marketing email with hero section, discount offer, CTA, and expiry countdown.",
    builtin: true,
    from: "", to: "",
    subject: "Exclusive offer just for you — {{DiscountPct}}% off 🎁",
    body: `Hi {{FirstName}},\n\nFor a limited time, enjoy {{DiscountPct}}% off your next purchase.\n\nUse code: {{CouponCode}}\nExpires: {{ExpiryDate}}\n\nShop now: https://shop.example.com?coupon={{CouponCode}}\n\nHappy shopping,\n{{AppName}} Team\n\n---\nUnsubscribe: https://example.com/unsubscribe`,
    html_body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Special Offer</title></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">🎁</div>
          <h1 style="color:#ffffff;margin:0;font-size:32px;font-weight:800;">{{DiscountPct}}% OFF</h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:17px;">Exclusively for you, {{FirstName}}</p>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 28px;">We're giving you an exclusive <strong>{{DiscountPct}}% discount</strong> on everything in our store. Use the code below at checkout:</p>
          <div style="display:inline-block;background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:16px 32px;margin-bottom:28px;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#92400e;display:block;margin-bottom:6px;">Your discount code</span>
            <span style="font-size:28px;font-weight:800;font-family:monospace;color:#78350f;letter-spacing:3px;">{{CouponCode}}</span>
          </div>
          <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">⏰ Expires {{ExpiryDate}} · Single use only</p>
          <a href="https://shop.example.com?coupon={{CouponCode}}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:17px;font-weight:700;">Shop Now →</a>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© 2026 {{AppName}} · <a href="https://example.com/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Level 4: Business ──────────────────────────────────────────────────
  {
    name: "B2B Partnership Outreach",
    category: "business",
    description: "Professional cold-outreach with hook, value prop, and easy-out CTA.",
    builtin: true,
    from: "", to: "",
    subject: "Partnership opportunity — {{YourCompany}} × {{TheirCompany}}",
    body: `Hi {{ContactName}},\n\nI'm {{YourName}}, {{YourTitle}} at {{YourCompany}}.\n\nI've been following {{TheirCompany}}'s work on {{SpecificThing}} — impressive results on {{Achievement}}.\n\nWe help companies like yours {{ValueProp}}. For example, we recently helped {{SimilarCompany}} {{Result}} in {{Timeframe}}.\n\nI'd love to explore whether there's a fit. Would you be open to a 20-minute call next week? Here's my calendar: https://cal.example.com/{{YourName}}\n\nIf the timing isn't right, no worries — happy to stay in touch.\n\nBest,\n{{YourName}}\n{{YourTitle}}, {{YourCompany}}\n{{YourPhone}} · {{YourEmail}}\nhttps://{{YourCompany}}.com`,
    html_body: null,
  },
  {
    name: "System Alert",
    category: "business",
    description: "Ops/monitoring incident alert with severity, affected systems, and on-call contact.",
    builtin: true,
    from: "", to: "",
    subject: "[{{Severity}}] {{ServiceName}} — {{AlertTitle}}",
    body: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠  SYSTEM ALERT — {{Severity}}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nService:    {{ServiceName}}\nAlert:      {{AlertTitle}}\nSeverity:   {{Severity}}  (P1=Critical / P2=High / P3=Medium)\nTime:       {{AlertTime}} UTC\nEnvironment: {{Environment}}\n\nAFFECTED SYSTEMS\n────────────────\n{{AffectedSystems}}\n\nDETAILS\n───────\n{{AlertDetails}}\n\nACTIONS TAKEN\n─────────────\n[ ] Acknowledged by on-call engineer\n[ ] Root cause identified\n[ ] Mitigation applied\n[ ] Incident resolved\n\nRUNBOOK\n───────\nhttps://runbook.example.com/{{RunbookSlug}}\n\nON-CALL CONTACT\n───────────────\nPrimary:   {{OncallName}} · {{OncallPhone}}\nEscalate:  {{EscalateName}} · {{EscalatePhone}}\nSlack:     #incidents\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAuto-generated by {{MonitoringTool}} · Do not reply\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    html_body: null,
  },
];

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
  $("#tpl-html-toggle").addEventListener("change", (e) => {
    $("#tpl-html-body").style.display = e.target.checked ? "" : "none";
  });

  $$(".tpl-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tpl-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTemplateFilter = btn.dataset.cat;
      renderTemplates();
    });
  });
}

function loadTemplatesFromStorage() {
  let userTemplates = [];
  try {
    userTemplates = JSON.parse(localStorage.getItem("smtplab-templates") || "[]");
  } catch { userTemplates = []; }
  // Builtins lead the list. If a user saved a template with the same name as a
  // builtin (e.g. a customised copy), the user version takes precedence and the
  // builtin with that name is hidden — intentional "override by name" behaviour.
  const userNames = new Set(userTemplates.map(t => t.name));
  templates = [
    ...BUILTIN_TEMPLATES.filter(t => !userNames.has(t.name)),
    ...userTemplates,
  ];
}

function saveTemplatesToStorage() {
  const userTemplates = templates.filter(t => !t.builtin);
  localStorage.setItem("smtplab-templates", JSON.stringify(userTemplates));
}

function openTemplateEditor(tpl, asCopy = false) {
  // If opening a builtin directly, open as a copy instead
  if (tpl?.builtin && !asCopy) {
    openTemplateEditor({ ...tpl, name: `${tpl.name} (copy)`, builtin: false }, true);
    return;
  }
  editingTemplate = (!asCopy && tpl) ? tpl.name : null;
  $("#template-editor-title").textContent = tpl ? (asCopy ? "Copy Template" : "Edit Template") : "New Template";
  $("#tpl-name").value = tpl ? tpl.name : "";
  $("#tpl-from").value = tpl?.from || "";
  $("#tpl-to").value   = tpl?.to   || "";
  $("#tpl-subject").value  = tpl?.subject  || "";
  $("#tpl-body").value     = tpl?.body     || "";
  $("#tpl-html-body").value = tpl?.html_body || "";
  $("#tpl-category").value  = tpl?.category || "custom";
  $("#tpl-description").value = tpl?.description || "";

  const hasHtml = !!(tpl?.html_body);
  $("#tpl-html-toggle").checked = hasHtml;
  $("#tpl-html-body").style.display = hasHtml ? "" : "none";

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
    from:        $("#tpl-from").value.trim(),
    to:          $("#tpl-to").value.trim(),
    subject:     $("#tpl-subject").value,
    body:        $("#tpl-body").value,
    html_body:   $("#tpl-html-toggle").checked ? $("#tpl-html-body").value : null,
    category:    $("#tpl-category").value,
    description: $("#tpl-description").value.trim(),
    builtin:     false,
  };

  if (editingTemplate) {
    // Guard rename: if the name changed, check the new name isn't already taken.
    if (name !== editingTemplate && templates.some(t => t.name === name)) {
      showToast("A template with this name already exists.", "warning");
      return;
    }
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
  const tpl = templates.find(t => t.name === name);
  if (tpl?.builtin) {
    showToast("Built-in templates cannot be deleted. Copy it first to customise.", "info");
    return;
  }
  templates = templates.filter((t) => t.name !== name);
  saveTemplatesToStorage();
  renderTemplates();
  showToast("Template deleted.", "info");
}

function useTemplate(tpl) {
  if (tpl.from)    $("#from").value = tpl.from;
  if (tpl.to)      $("#to").value = tpl.to;
  if (tpl.subject) $("#subject").value = tpl.subject;

  const htmlToggle = $("#html-mode");
  if (tpl.html_body) {
    // Switch TO html mode and load html_body. Do NOT also set tpl.body —
    // both versions share the same #body textarea and html_body takes priority.
    if (htmlToggle && !htmlToggle.checked) htmlToggle.click();
    $("#body").value = tpl.html_body;
  } else {
    // Ensure html mode is OFF, then load plain body.
    if (htmlToggle && htmlToggle.checked) htmlToggle.click();
    if (tpl.body) $("#body").value = tpl.body;
  }

  saveFormState();
  navigateTo("test");
  showToast(`Template "${tpl.name}" loaded.`, "success");
}

function renderTemplates() {
  const filtered = activeTemplateFilter === "all"
    ? templates
    : templates.filter(t => (t.category || "custom") === activeTemplateFilter);

  if (filtered.length === 0) {
    templateList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h3>No Templates</h3>
        <p>${activeTemplateFilter === "all"
          ? 'Create reusable email templates to speed up your testing workflow.'
          : `No templates in the <strong>${activeTemplateFilter}</strong> category.`}</p>
      </div>`;
    return;
  }

  const catColors = {
    basic: "tpl-cat-basic", transactional: "tpl-cat-transactional",
    html: "tpl-cat-html", business: "tpl-cat-business", custom: "tpl-cat-custom",
  };

  templateList.innerHTML = filtered.map(t => {
    const catClass = catColors[t.category] || catColors.custom;
    const catLabel = t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : "Custom";
    const tJson = JSON.stringify(t).replace(/"/g, '&quot;');
    return `
    <div class="template-card${t.builtin ? " template-card-builtin" : ""}">
      <div class="template-card-top">
        <div class="template-card-badges">
          <span class="tpl-cat-badge ${catClass}">${catLabel}</span>
          ${t.builtin ? '<span class="tpl-builtin-badge">Built-in</span>' : ''}
          ${t.html_body ? '<span class="tpl-html-badge">HTML</span>' : ''}
        </div>
        <div class="template-card-actions">
          <button class="btn btn-accent btn-sm" onclick="useTemplate(${tJson})">Use</button>
          <button class="btn-icon" onclick="openTemplateEditor(${tJson})" title="${t.builtin ? 'Copy &amp; Edit' : 'Edit'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              ${t.builtin
                ? '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
                : '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'}
            </svg>
          </button>
          ${t.builtin ? '' : `<button class="btn-icon" onclick="deleteTemplate('${escapeHtml(t.name)}')" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>`}
        </div>
      </div>
      <div class="template-card-name">${escapeHtml(t.name)}</div>
      ${t.description ? `<div class="template-card-desc">${escapeHtml(t.description)}</div>` : ''}
      <div class="template-card-detail">${escapeHtml(t.subject || '(no subject)')} &mdash; ${escapeHtml(t.from || '(no sender)')}</div>
    </div>`;
  }).join("");
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
