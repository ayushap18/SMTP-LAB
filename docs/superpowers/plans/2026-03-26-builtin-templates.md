# Built-in Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 13 categorised built-in email templates (basic → transactional → HTML → business) that ship with SMTP Lab, are filterable by category, non-deletable but copyable, and extend the template schema to support `html_body`, `category`, `description`, and `builtin` fields.

**Architecture:** Built-in templates live as a JS constant `BUILTIN_TEMPLATES` injected at startup into the in-memory list (never written to localStorage). User templates continue to live in localStorage. The template list gains a category filter bar. The editor gains an HTML body field. `useTemplate()` maps `html_body` onto the test form's HTML-mode textarea.

**Tech Stack:** Vanilla JS (ES2020), HTML, CSS — no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `desktop-app/src/app.js` | Add `BUILTIN_TEMPLATES` constant; update `loadTemplatesFromStorage`, `renderTemplates`, `openTemplateEditor`, `saveTemplate`, `useTemplate`, `deleteTemplate`; add `filterTemplates` |
| `desktop-app/src/index.html` | Add category filter bar + HTML body textarea to template editor |
| `desktop-app/src/styles.css` | Category filter bar, template card badges, builtin indicator |

---

## Template Catalogue (reference — used verbatim in Task 1)

### Category: `basic` — Level 1 (plain text, minimal)

**1. Plain Text Ping**
- Subject: `SMTP Connectivity Test`
- Body: `Hello,\n\nThis is an automated connectivity test sent by SMTP Lab.\n\nIf you received this email, your SMTP server is working correctly.\n\nTimestamp: {{timestamp}}\n\n— SMTP Lab`

**2. Delivery Echo**
- Subject: `Delivery Verification — Please Reply`
- Body: `Hi,\n\nThis is a delivery verification email. If you received this, please reply with "Received" so we can confirm end-to-end delivery.\n\nSent at: {{timestamp}}\nServer tested: {{host}}\n\nThank you,\nSMTP Lab Diagnostics`

---

### Category: `transactional` — Level 2 (structured plain text)

**3. Welcome Email**
- Subject: `Welcome to {{AppName}} — Let's get started`
- Body:
```
Hi {{FirstName}},

Welcome aboard! We're thrilled to have you.

Here's what you can do next:

  1. Complete your profile at https://app.example.com/profile
  2. Explore the dashboard at https://app.example.com/dashboard
  3. Invite your team at https://app.example.com/team

If you have any questions, reply to this email or visit our help centre at https://help.example.com.

Cheers,
The {{AppName}} Team

---
You received this email because you signed up at example.com.
Unsubscribe: https://example.com/unsubscribe
```

**4. Password Reset**
- Subject: `Reset your password`
- Body:
```
Hi {{FirstName}},

We received a request to reset the password for your account associated with this email address.

Click the link below to reset your password (valid for 30 minutes):

  https://app.example.com/reset?token=REPLACE_WITH_TOKEN

If you did not request a password reset, please ignore this email. Your password will not change.

For security, this link expires in 30 minutes.

— The {{AppName}} Security Team

---
If you're having trouble clicking the link, copy and paste the URL above into your web browser.
```

**5. Order Confirmation**
- Subject: `Order #{{OrderID}} confirmed — Thank you!`
- Body:
```
Hi {{FirstName}},

Thank you for your order! Here's a summary:

ORDER #{{OrderID}}
─────────────────────────────────────
Product                  Qty    Price
─────────────────────────────────────
Premium Plan (Annual)      1   $99.00
Setup Fee                  1   $19.00
─────────────────────────────────────
Subtotal                        $118.00
Tax (8%)                          $9.44
TOTAL                           $127.44
─────────────────────────────────────

Payment method: Visa ending 4242
Billing address: 123 Main St, San Francisco CA 94105

Your order will be processed within 1–2 business days.
Track your order: https://example.com/orders/{{OrderID}}

Questions? Reply to this email or visit https://help.example.com.

— The {{AppName}} Team
```

**6. Shipping Notification**
- Subject: `Your order #{{OrderID}} has shipped`
- Body:
```
Hi {{FirstName}},

Great news — your order is on its way!

TRACKING DETAILS
────────────────
Carrier:         FedEx
Tracking number: {{TrackingNumber}}
Estimated delivery: {{DeliveryDate}}

Track your package: https://fedex.com/track?id={{TrackingNumber}}

WHAT YOU ORDERED
────────────────
Premium Plan (Annual) × 1

If you have any questions, contact us at support@example.com.

— {{AppName}} Fulfilment Team
```

**7. Invoice**
- Subject: `Invoice #{{InvoiceID}} from {{AppName}} — Due {{DueDate}}`
- Body:
```
INVOICE #{{InvoiceID}}
══════════════════════════════════════════
From:   {{AppName}}, 1 Market St, SF CA 94105
To:     {{ClientName}}, {{ClientAddress}}
Date:   {{InvoiceDate}}
Due:    {{DueDate}}

ITEMS
──────────────────────────────────────────
Description               Hours    Amount
──────────────────────────────────────────
Software Development        40    $4,000.00
UI/UX Design                 8      $800.00
Code Review                  4      $400.00
──────────────────────────────────────────
Subtotal                          $5,200.00
Tax (10%)                           $520.00
AMOUNT DUE                        $5,720.00
──────────────────────────────────────────

Payment instructions:
  Bank: First National Bank
  Account: 123456789
  Routing: 987654321
  Reference: INV-{{InvoiceID}}

Please pay by {{DueDate}}. Late payments incur a 1.5% monthly fee.

Thank you for your business!
{{AppName}} Accounts — accounts@example.com
```

---

### Category: `html` — Level 3 (HTML emails)

**8. HTML Welcome Email**
- Subject: `Welcome to {{AppName}} — You're in! 🎉`
- html_body: Full branded HTML (see exact code in Task 1)

**9. HTML Newsletter**
- Subject: `{{AppName}} Monthly Digest — {{Month}} {{Year}}`
- html_body: Three-section newsletter with header, articles, footer

**10. HTML Promotional**
- Subject: `🎁 Exclusive offer just for you — {{DiscountPct}}% off`
- html_body: Hero image placeholder, offer block, CTA button, expiry

---

### Category: `business` — Level 4 (professional/B2B)

**11. B2B Partnership Outreach**
- Subject: `Partnership opportunity — {{YourCompany}} × {{TheirCompany}}`
- Body: Professional cold-outreach structure (hook, value prop, CTA, easy out)

**12. System Alert / Incident**
- Subject: `[{{Severity}}] {{ServiceName}} — {{AlertTitle}}`
- Body: Severity-tagged ops alert with affected systems, actions, on-call contact

---

## Task 1 — Add BUILTIN_TEMPLATES constant + schema extension

**Files:**
- Modify: `desktop-app/src/app.js` (add constant near top, after state declarations ~line 65)

- [ ] **Step 1: Add the constant just after the `// Monitor` state block in app.js**

Insert after line ~64 (`let relativeTimeTicker = null;`):

```js
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
    from: "noreply@example.com", to: "",
    subject: "Welcome to {{AppName}} — Let's get started",
    body: `Hi {{FirstName}},\n\nWelcome aboard! We're thrilled to have you.\n\nHere's what you can do next:\n\n  1. Complete your profile at https://app.example.com/profile\n  2. Explore the dashboard at https://app.example.com/dashboard\n  3. Invite your team at https://app.example.com/team\n\nIf you have any questions, reply to this email or visit our help centre at https://help.example.com.\n\nCheers,\nThe {{AppName}} Team\n\n---\nYou received this email because you signed up at example.com.\nUnsubscribe: https://example.com/unsubscribe`,
    html_body: null,
  },
  {
    name: "Password Reset",
    category: "transactional",
    description: "Password reset with 30-minute expiry link placeholder.",
    builtin: true,
    from: "security@example.com", to: "",
    subject: "Reset your password",
    body: `Hi {{FirstName}},\n\nWe received a request to reset the password for your account associated with this email address.\n\nClick the link below to reset your password (valid for 30 minutes):\n\n  https://app.example.com/reset?token=REPLACE_WITH_TOKEN\n\nIf you did not request a password reset, please ignore this email. Your password will not change.\n\n— The {{AppName}} Security Team`,
    html_body: null,
  },
  {
    name: "Order Confirmation",
    category: "transactional",
    description: "Structured order summary with line items, totals, and tracking link.",
    builtin: true,
    from: "orders@example.com", to: "",
    subject: "Order #{{OrderID}} confirmed — Thank you!",
    body: `Hi {{FirstName}},\n\nThank you for your order! Here's a summary:\n\nORDER #{{OrderID}}\n─────────────────────────────────────\nProduct                  Qty    Price\n─────────────────────────────────────\nPremium Plan (Annual)      1   $99.00\nSetup Fee                  1   $19.00\n─────────────────────────────────────\nSubtotal                        $118.00\nTax (8%)                          $9.44\nTOTAL                           $127.44\n─────────────────────────────────────\n\nPayment method: Visa ending 4242\n\nTrack your order: https://example.com/orders/{{OrderID}}\n\n— The {{AppName}} Team`,
    html_body: null,
  },
  {
    name: "Shipping Notification",
    category: "transactional",
    description: "Package shipped alert with carrier, tracking number, and ETA.",
    builtin: true,
    from: "shipping@example.com", to: "",
    subject: "Your order #{{OrderID}} has shipped",
    body: `Hi {{FirstName}},\n\nGreat news — your order is on its way!\n\nTRACKING DETAILS\n────────────────\nCarrier:         FedEx\nTracking number: {{TrackingNumber}}\nEstimated delivery: {{DeliveryDate}}\n\nTrack: https://fedex.com/track?id={{TrackingNumber}}\n\nIf you have any questions, contact us at support@example.com.\n\n— {{AppName}} Fulfilment Team`,
    html_body: null,
  },
  {
    name: "Invoice",
    category: "transactional",
    description: "Formal invoice with line items, subtotal, tax, payment instructions.",
    builtin: true,
    from: "accounts@example.com", to: "",
    subject: "Invoice #{{InvoiceID}} from {{AppName}} — Due {{DueDate}}",
    body: `INVOICE #{{InvoiceID}}\n══════════════════════════════════════════\nFrom:   {{AppName}}, 1 Market St, SF CA 94105\nTo:     {{ClientName}}, {{ClientAddress}}\nDate:   {{InvoiceDate}}\nDue:    {{DueDate}}\n\nITEMS\n──────────────────────────────────────────\nDescription               Hours    Amount\n──────────────────────────────────────────\nSoftware Development        40    $4,000.00\nUI/UX Design                 8      $800.00\nCode Review                  4      $400.00\n──────────────────────────────────────────\nSubtotal                          $5,200.00\nTax (10%)                           $520.00\nAMOUNT DUE                        $5,720.00\n──────────────────────────────────────────\n\nPayment: Bank transfer to Account 123456789\nReference: INV-{{InvoiceID}}\n\nThank you for your business!\n{{AppName}} Accounts — accounts@example.com`,
    html_body: null,
  },
  {
    name: "Account Verification",
    category: "transactional",
    description: "Email verification with OTP code and fallback link.",
    builtin: true,
    from: "noreply@example.com", to: "",
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
    from: "noreply@example.com", to: "",
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
          <!-- Feature list -->
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
    from: "newsletter@example.com", to: "",
    subject: "{{AppName}} Monthly Digest — {{Month}} {{Year}}",
    body: `{{AppName}} Monthly Digest\n\nHi {{FirstName}},\n\nHere's what happened this month:\n\n1. NEW FEATURE: Dark mode is now available\n   We heard your feedback. Flip the switch in Settings → Appearance.\n   Read more: https://blog.example.com/dark-mode\n\n2. PERFORMANCE: 40% faster load times\n   Our infrastructure upgrade is complete — enjoy the speed.\n   Read more: https://blog.example.com/performance\n\nSee everything: https://blog.example.com\n\n— The {{AppName}} Team\nUnsubscribe: https://example.com/unsubscribe`,
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
          <!-- Article 1 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#ede9fe;padding:20px 24px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;">New Feature</span>
              <h2 style="color:#111827;font-size:18px;margin:8px 0 4px;">Dark Mode is Here 🌙</h2>
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">We heard your feedback loud and clear. Dark mode is now available across all screens. Flip the switch in Settings → Appearance.</p>
              <a href="https://blog.example.com/dark-mode" style="color:#7c3aed;font-size:14px;font-weight:600;text-decoration:none;">Read more →</a>
            </td></tr>
          </table>
          <!-- Article 2 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#dcfce7;padding:20px 24px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">Performance</span>
              <h2 style="color:#111827;font-size:18px;margin:8px 0 4px;">40% Faster Load Times ⚡</h2>
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">Our infrastructure upgrade is complete. Pages now load 40% faster on average — especially noticeable on mobile.</p>
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
    from: "offers@example.com", to: "",
    subject: "Exclusive offer just for you — {{DiscountPct}}% off 🎁",
    body: `Hi {{FirstName}},\n\nFor a limited time, enjoy {{DiscountPct}}% off your next purchase.\n\nUse code: {{CouponCode}}\nExpires: {{ExpiryDate}}\n\nShop now: https://shop.example.com?coupon={{CouponCode}}\n\nHappy shopping,\n{{AppName}} Team\n\n---\nUnsubscribe: https://example.com/unsubscribe`,
    html_body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Special Offer</title></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Hero -->
        <tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">🎁</div>
          <h1 style="color:#ffffff;margin:0;font-size:32px;font-weight:800;">{{DiscountPct}}% OFF</h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:17px;">Exclusively for you, {{FirstName}}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;text-align:center;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 28px;">We're giving you an exclusive <strong>{{DiscountPct}}% discount</strong> on everything in our store. Use the code below at checkout:</p>
          <!-- Coupon -->
          <div style="display:inline-block;background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:16px 32px;margin-bottom:28px;">
            <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#92400e;display:block;margin-bottom:6px;">Your discount code</span>
            <span style="font-size:28px;font-weight:800;font-family:monospace;color:#78350f;letter-spacing:3px;">{{CouponCode}}</span>
          </div>
          <p style="color:#9ca3af;font-size:13px;margin:0 0 28px;">⏰ Expires {{ExpiryDate}} · Single use only</p>
          <a href="https://shop.example.com?coupon={{CouponCode}}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:17px;font-weight:700;">Shop Now →</a>
        </td></tr>
        <!-- Footer -->
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
    from: "alerts@example.com", to: "oncall@example.com",
    subject: "[{{Severity}}] {{ServiceName}} — {{AlertTitle}}",
    body: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠  SYSTEM ALERT — {{Severity}}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nService:    {{ServiceName}}\nAlert:      {{AlertTitle}}\nSeverity:   {{Severity}}  (P1=Critical / P2=High / P3=Medium)\nTime:       {{AlertTime}} UTC\nEnvironment: {{Environment}}\n\nAFFECTED SYSTEMS\n────────────────\n{{AffectedSystems}}\n\nDETAILS\n───────\n{{AlertDetails}}\n\nACTIONS TAKEN\n─────────────\n[ ] Acknowledged by on-call engineer\n[ ] Root cause identified\n[ ] Mitigation applied\n[ ] Incident resolved\n\nRUNBOOK\n───────\nhttps://runbook.example.com/{{RunbookSlug}}\n\nON-CALL CONTACT\n───────────────\nPrimary:   {{OncallName}} · {{OncallPhone}}\nEscalate:  {{EscalateName}} · {{EscalatePhone}}\nSlack:     #incidents\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nAuto-generated by {{MonitoringTool}} · Do not reply\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    html_body: null,
  },
];
```

- [ ] **Step 2: Commit the constant (no UI change yet)**

```bash
git add desktop-app/src/app.js
git commit -m "feat: add BUILTIN_TEMPLATES constant (12 templates, 4 categories)"
```

---

## Task 2 — Wire builtins into loadTemplatesFromStorage + extend useTemplate

**Files:**
- Modify: `desktop-app/src/app.js` — functions `loadTemplatesFromStorage`, `useTemplate`, `deleteTemplate`

Current `loadTemplatesFromStorage` (line ~476):
```js
function loadTemplatesFromStorage() {
  try {
    templates = JSON.parse(localStorage.getItem("smtplab-templates") || "[]");
  } catch { templates = []; }
}
```

- [ ] **Step 1: Replace `loadTemplatesFromStorage`**

```js
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
```

- [ ] **Step 2: Guard `saveTemplatesToStorage` — never persist builtins**

Current `saveTemplatesToStorage`:
```js
function saveTemplatesToStorage() {
  localStorage.setItem("smtplab-templates", JSON.stringify(templates));
}
```

Replace with:
```js
function saveTemplatesToStorage() {
  const userTemplates = templates.filter(t => !t.builtin);
  localStorage.setItem("smtplab-templates", JSON.stringify(userTemplates));
}
```

- [ ] **Step 3: Update `useTemplate` to also fill `html_body`**

Current (line ~539):
```js
function useTemplate(tpl) {
  if (tpl.from)    $("#from").value = tpl.from;
  if (tpl.to)      $("#to").value = tpl.to;
  if (tpl.subject) $("#subject").value = tpl.subject;
  if (tpl.body)    $("#body").value = tpl.body;
  saveFormState();
  navigateTo("test");
  showToast(`Template "${tpl.name}" loaded.`, "success");
}
```

Replace with:
```js
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
```

- [ ] **Step 4: Update `deleteTemplate` to block builtin deletion**

```js
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
```

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/app.js
git commit -m "feat: wire builtins into template loading; guard delete; fill html_body on use"
```

---

## Task 3 — Template editor: add HTML body field + category/description + Copy builtin

**Files:**
- Modify: `desktop-app/src/index.html` — template editor form
- Modify: `desktop-app/src/app.js` — `openTemplateEditor`, `saveTemplate`

- [ ] **Step 1: Add fields to template editor form in `index.html`**

After `<div class="form-group"><label for="tpl-body">Body</label>...` insert:

```html
<div class="form-group">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
    <label for="tpl-html-body" style="margin:0;">HTML Body <span class="text-dim">(optional)</span></label>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
      <input type="checkbox" id="tpl-html-toggle" />
      Show HTML editor
    </label>
  </div>
  <textarea id="tpl-html-body" rows="8" placeholder="Paste full HTML email here..."
            style="display:none;font-family:var(--font-mono);font-size:12px;"></textarea>
</div>
<div class="form-row">
  <div class="form-group flex-1">
    <label for="tpl-category">Category</label>
    <select id="tpl-category">
      <option value="basic">Basic</option>
      <option value="transactional">Transactional</option>
      <option value="html">HTML</option>
      <option value="business">Business</option>
      <option value="custom" selected>Custom</option>
    </select>
  </div>
  <div class="form-group flex-1">
    <label for="tpl-description">Description <span class="text-dim">(optional)</span></label>
    <input type="text" id="tpl-description" placeholder="Brief description..." />
  </div>
</div>
```

- [ ] **Step 2: Wire the HTML toggle in `setupTemplatePage`**

Add inside `setupTemplatePage()`:
```js
$("#tpl-html-toggle").addEventListener("change", (e) => {
  $("#tpl-html-body").style.display = e.target.checked ? "" : "none";
});
```

- [ ] **Step 3: Update `openTemplateEditor` to populate all new fields**

Replace existing `openTemplateEditor`:
```js
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
```

- [ ] **Step 4: Update `saveTemplate` to persist new fields**

```js
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
```

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/index.html desktop-app/src/app.js
git commit -m "feat: template editor supports html_body, category, description; builtin → copy flow"
```

---

## Task 4 — Template list: category filter + redesigned cards

**Files:**
- Modify: `desktop-app/src/index.html` — add filter bar above `#template-list`
- Modify: `desktop-app/src/app.js` — `renderTemplates`, `filterTemplates` (new)
- Modify: `desktop-app/src/styles.css` — filter bar + category badges + builtin indicator

- [ ] **Step 1: Add filter bar to `index.html`** (inside `#page-templates`, before `#template-list`)

```html
<div id="tpl-filter-bar" class="tpl-filter-bar">
  <button class="tpl-filter-btn active" data-cat="all">All</button>
  <button class="tpl-filter-btn" data-cat="basic">Basic</button>
  <button class="tpl-filter-btn" data-cat="transactional">Transactional</button>
  <button class="tpl-filter-btn" data-cat="html">HTML</button>
  <button class="tpl-filter-btn" data-cat="business">Business</button>
  <button class="tpl-filter-btn" data-cat="custom">Custom</button>
</div>
```

- [ ] **Step 2: Add `activeTemplateFilter` at module scope (app.js)**

In `app.js`, alongside `let editingTemplate = null;` (~line 59), add:
```js
let activeTemplateFilter = "all";
```

- [ ] **Step 3: Wire filter buttons inside `setupTemplatePage`**

```js
$$(".tpl-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tpl-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeTemplateFilter = btn.dataset.cat;
    renderTemplates();
  });
});
```

- [ ] **Step 4: Replace `renderTemplates` with filter-aware version**

> ⚠ **Security note:** The template cards below use inline `onclick` with serialised JSON for builtins (safe — hard-coded constants). User-authored templates could contain arbitrary text in `body` / `html_body`. The `.replace(/"/g,"&quot;")` escaping is applied to the whole JSON string, which is sufficient for the attribute context used here because Tauri's WebView is a sandboxed local page (no network, no cross-origin). If this pattern is ever ported to a web app, replace with `data-*` attributes + a delegated `click` listener on `#template-list`.

```js
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
          <button class="btn-icon" onclick="openTemplateEditor(${tJson})" title="${t.builtin ? 'Copy & Edit' : 'Edit'}">
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
```

- [ ] **Step 5: Add CSS**

Append to `desktop-app/src/styles.css`:

```css
/* ================================================================
   TEMPLATES — filter bar + redesigned cards
   ================================================================ */
.tpl-filter-bar {
  display: flex; gap: 6px; padding: 12px 16px;
  border-bottom: 1px solid var(--border); flex-wrap: wrap; flex-shrink: 0;
}
.tpl-filter-btn {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; transition: all .15s;
}
.tpl-filter-btn:hover { border-color: var(--accent); color: var(--accent); }
.tpl-filter-btn.active {
  background: var(--accent); border-color: var(--accent);
  color: #fff; font-weight: 600;
}

/* Card redesign */
.template-card {
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; margin-bottom: 10px;
  background: var(--surface-2); transition: border-color .15s;
}
.template-card:hover { border-color: var(--accent); }
.template-card-builtin { border-left: 3px solid var(--accent); }

.template-card-top {
  display: flex; justify-content: space-between;
  align-items: flex-start; margin-bottom: 8px;
}
.template-card-badges { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.template-card-actions { display: flex; gap: 4px; align-items: center; }

.template-card-name { font-weight: 600; font-size: 14px; margin-bottom: 3px; }
.template-card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.template-card-detail { font-size: 12px; color: var(--text-dim); }

/* Category badges */
.tpl-cat-badge {
  display: inline-block; padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px;
}
.tpl-cat-basic        { background: rgba(96,165,250,.15); color: #60a5fa; }
.tpl-cat-transactional{ background: rgba(52,211,153,.15); color: #34d399; }
.tpl-cat-html         { background: rgba(167,139,250,.15); color: #a78bfa; }
.tpl-cat-business     { background: rgba(251,191,36,.15); color: #fbbf24; }
.tpl-cat-custom       { background: var(--surface-3); color: var(--text-dim); }

.tpl-builtin-badge {
  display: inline-block; padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 600; background: var(--accent-dim); color: var(--accent);
}
.tpl-html-badge {
  display: inline-block; padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 600; background: rgba(167,139,250,.15); color: #a78bfa;
}
```

- [ ] **Step 6: Commit**

```bash
git add desktop-app/src/index.html desktop-app/src/app.js desktop-app/src/styles.css
git commit -m "feat: template filter bar, category badges, builtin indicator, redesigned cards"
```

---

## Task 5 — Template list layout fix + page-templates structure

**Files:**
- Modify: `desktop-app/src/index.html` — ensure `#page-templates` uses flex column
- Modify: `desktop-app/src/styles.css` — page-templates layout

The `#page-templates` page needs to accommodate: page-header + filter-bar + scrollable template-list. Currently `template-list` may not scroll properly.

- [ ] **Step 1: Check `page-templates` CSS and update**

In `styles.css`, find `.page` and ensure `#page-templates` scrolls correctly:

```css
/* Templates page layout */
#page-templates {
  display: flex; flex-direction: column;
}
#page-templates .template-list-wrap {
  flex: 1; overflow-y: auto; padding: 16px;
}
```

- [ ] **Step 2: Wrap `#template-list` in `index.html`**

In `index.html`, find the `#page-templates` section. The current structure is:

```html
<div id="template-list" class="template-list"></div>
```

Replace with:

```html
<div class="template-list-wrap">
  <div id="template-list" class="template-list"></div>
</div>
```

The `template-list-wrap` closing `</div>` goes immediately after the `#template-list` closing `</div>` — before the `</div>` that closes `#page-templates`.

- [ ] **Step 3: Commit**

```bash
git add desktop-app/src/index.html desktop-app/src/styles.css desktop-app/src/app.js
git commit -m "fix: template list scrollable layout; activeTemplateFilter at module scope"
```

---

## Verification Checklist

After all tasks complete, verify in the running app (`cargo tauri dev`):

- [ ] Templates page shows 13 built-in cards immediately on first launch (no localStorage data needed)
- [ ] Clicking a category filter shows only templates in that category
- [ ] Clicking "Use" on a basic template loads subject + body into the Test form
- [ ] Clicking "Use" on an HTML template switches Test form to HTML mode and loads html_body
- [ ] Clicking edit icon on a builtin opens editor titled "Copy Template" with name pre-set to `"<name> (copy)"`
- [ ] Saving the copy adds a new user template; original builtin still appears
- [ ] Delete button is absent on builtin cards; present on user-created cards
- [ ] "New Template" button opens a blank editor with Category = Custom
- [ ] HTML body textarea only appears when "Show HTML editor" checkbox is checked
- [ ] After clearing localStorage, builtins still appear (they don't come from storage)
- [ ] Category badges render with correct colours: blue=basic, green=transactional, purple=html, yellow=business
