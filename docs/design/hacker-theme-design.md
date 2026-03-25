# SMTP Lab - Hacker Matrix Theme Design Specification

## 🎯 Design Vision

**Aesthetic:** Cyberpunk/Matrix-inspired hacker terminal with sleek green-on-dark aesthetics. 
**Mood:** Professional yet edgy, technical, high-performance, futuristic
**Inspiration:** Matrix green rain, terminal interfaces, cybersecurity tools, retro-futurism

---

## 🎨 Color Palette

### Primary Colors (Hacker Green Spectrum)
```css
/* Main Green Palette */
--matrix-green:       #00FF41    /* Bright matrix green - for accents, highlights */
--hacker-green:       #0FBF3C    /* Primary action green */
--cyber-green:        #00D639    /* Secondary green */
--terminal-green:     #39FF14    /* Neon green for emphasis */
--dark-green:         #0A4A1E    /* Muted green for subtle backgrounds */
--green-dim:          rgba(0, 255, 65, 0.08)   /* Transparent green */
--green-glow:         rgba(0, 255, 65, 0.15)   /* Glow effect */
--green-shadow:       rgba(0, 255, 65, 0.25)   /* Shadow with green tint */

/* Accent Greens (for variety) */
--accent-cyan:        #00FFFF    /* Cyan for information */
--accent-lime:        #ADFF2F    /* Lime for warnings */
--accent-emerald:     #50C878    /* Softer green for success */
```

### Background Spectrum (True Blacks)
```css
/* Dark Backgrounds */
--bg-void:            #000000    /* Pure black */
--bg-deep:            #040804    /* Near-black with green tint */
--bg-main:            #0A0F0A    /* Main background */
--bg-elevated:        #0D120D    /* Elevated surfaces */
--surface:            #111611    /* Cards, sidebars */
--surface-2:          #151A15    /* Input backgrounds */
--surface-3:          #1A201A    /* Hover states */

/* Borders & Lines */
--border-dark:        #1A251A    /* Subtle borders */
--border-main:        #243024    /* Main borders */
--border-bright:      #304030    /* Prominent borders */
--border-glow:        rgba(0, 255, 65, 0.2)  /* Glowing borders */
```

### Text Colors
```css
--text-bright:        #E0FFE0    /* Primary text (slightly green-tinted white) */
--text-main:          #B8D4B8    /* Secondary text */
--text-muted:         #708070    /* Muted text */
--text-dim:           #405040    /* Very dim text */
--text-matrix:        #00FF41    /* Matrix green text for emphasis */
```

### Status Colors
```css
--status-success:     #00FF41    /* Bright green */
--status-warning:     #FFD700    /* Gold/Yellow (hacker amber) */
--status-error:       #FF3333    /* Bright red */
--status-info:        #00BFFF    /* Cyan blue */

/* Dim versions for backgrounds */
--success-dim:        rgba(0, 255, 65, 0.12)
--warning-dim:        rgba(255, 215, 0, 0.12)
--error-dim:          rgba(255, 51, 51, 0.12)
--info-dim:           rgba(0, 191, 255, 0.12)
```

---

## 📐 Typography

### Fonts
```css
/* Primary: Monospace fonts for that hacker terminal feel */
--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Source Code Pro", monospace;

/* Secondary: Clean sans-serif for readability */
--font-ui: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Font Sizes
```
Logo:        18px, weight 800, tracking -0.02em
Headings:    14-16px, weight 700, uppercase optional
Body:        13px, weight 500
Labels:      11px, weight 600, uppercase, tracking 0.08em
Code/Logs:   12px, weight 500, monospace
```

---

## 🌟 Special Effects

### Glow Effects
```css
/* Text glow */
.glow-text {
  text-shadow: 0 0 4px var(--matrix-green),
               0 0 8px rgba(0, 255, 65, 0.5),
               0 0 12px rgba(0, 255, 65, 0.3);
}

/* Box glow (for buttons, active states) */
.glow-box {
  box-shadow: 0 0 10px rgba(0, 255, 65, 0.3),
              0 0 20px rgba(0, 255, 65, 0.1),
              inset 0 0 10px rgba(0, 255, 65, 0.05);
}

/* Border glow */
.glow-border {
  border: 1px solid var(--matrix-green);
  box-shadow: 0 0 5px rgba(0, 255, 65, 0.3);
}
```

### Scanline Effect (Optional, subtle)
```css
.scanlines::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 1px,
    rgba(0, 255, 65, 0.03) 2px,
    rgba(0, 255, 65, 0.03) 3px
  );
  pointer-events: none;
}
```

### Matrix Rain Background (CSS animation for header/hero areas)
```css
@keyframes matrix-rain {
  0% { background-position: 0 0; }
  100% { background-position: 0 100vh; }
}
```

---

## 🧩 Component Designs

### Sidebar
```
Background:     --surface (#111611)
Border:         1px solid --border-main (#243024)
Active item:    --green-dim background, --matrix-green left border
Logo:           Matrix green with glow effect
Version:        --text-dim monospace
```

### Navigation Items
```
Default:        --text-muted, transparent bg
Hover:          --text-main, --surface-2 bg
Active:         --matrix-green text, --green-dim bg, 3px left border glowing
Icon:           Same color as text, 18px
```

### Form Inputs
```
Background:     --surface-2
Border:         1px solid --border-dark
Focus border:   --matrix-green
Focus glow:     0 0 0 3px --green-dim, 0 0 10px rgba(0,255,65,0.1)
Text:           --text-bright, monospace
Placeholder:    --text-dim
```

### Buttons

**Primary Button (Send/Execute actions):**
```
Background:     linear-gradient(135deg, #0A4A1E, #0D5A22)
Border:         1px solid --hacker-green
Text:           --matrix-green, bold
Hover:          --hacker-green solid bg, glow effect
Active:         Slight scale down
```

**Secondary Button:**
```
Background:     transparent
Border:         1px solid --border-bright
Text:           --text-main
Hover:          --surface-3 bg, --text-bright text
```

**Icon Buttons:**
```
Background:     transparent
Color:          --text-dim
Hover:          --surface-2 bg, --matrix-green color
```

### Log Viewer (The Star Component!)
```
Background:     --bg-main (pure dark)
Font:           12px monospace
Line height:    1.8
Scanlines:      Subtle overlay (optional)

Timestamp:      --text-dim, 85px width
Level badge:    Colored based on level
Stage:          --matrix-green, bold
Message:        --text-main

Log levels:
  [INFO]        --info (cyan)
  [OK]          --status-success (matrix green, with glow!)
  [WARN]        --status-warning (gold)
  [ERR]         --status-error (red)
  [DBG]         --text-muted
```

### Cards
```
Background:     --surface
Border:         1px solid --border-main
Radius:         10px
Shadow:         0 4px 12px rgba(0,0,0,0.4)
Header border:  Bottom 1px solid --border-dark
```

### Status Indicator
```
Idle:           --text-dim (gray dot)
Running:        --status-warning (amber, pulsing)
Success:        --status-success (green, glowing)
Error:          --status-error (red)
```

### Toast Notifications
```
Background:     --surface with slight transparency
Border-left:    4px solid (status color)
Shadow:         Glow in status color
Animation:      Slide in from right
```

---

## 🖼️ Screen Layouts

### Test Page Layout
```
┌──────────────────────────────────────────────────────────────┐
│ [Sidebar]          │ [Form Panel]        │ [Log Panel]       │
│                    │                     │                   │
│ ┌──────────────┐   │ ═══ Connection ═══  │ ═══ Live Logs ═══ │
│ │ ◈ SMTP Lab   │   │ Host: [_______]     │ ┌───────────────┐ │
│ │   v0.1.0     │   │ Port: [587]         │ │ 14:32:05 [OK] │ │
│ └──────────────┘   │ Encryption: [▼]     │ │ CONNECT       │ │
│                    │                     │ │ Connected...  │ │
│ ─────────────────  │ ═══ Auth ═══        │ │               │ │
│ ▸ Test         *   │ Username: [____]    │ │ 14:32:06 [OK] │ │
│ ▹ Templates        │ Password: [••••]    │ │ AUTH          │ │
│ ▹ History          │                     │ │ Authenticated │ │
│ ▹ DNS Tools        │ ═══ Message ═══     │ │               │ │
│ ▹ Settings         │ From: [_______]     │ │ [Matrix green │ │
│                    │ To:   [_______]     │ │  scrolling    │ │
│ ─────────────────  │ Subject: [____]     │ │  effect...]   │ │
│ PROFILES           │ Body: [________]    │ │               │ │
│ ▸ Gmail            │                     │ └───────────────┘ │
│ ▹ Outlook          │ [▶ SEND TEST]       │                   │
│ ▹ Custom           │ [◈ Diagnostics]     │ [Copy] [Export]   │
│                    │                     │ [Clear]           │
└──────────────────────────────────────────────────────────────┘
```

### DNS Tools Page
```
┌────────────────────────────────────────┐
│ DNS TOOLS                              │
│ ══════════════════════════════════════ │
│                                        │
│ Domain: [___________________] [LOOKUP] │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ MX Records                       │   │
│ │ ─────────────────────────────── │   │
│ │ 10  mail.example.com    ✓       │   │
│ │ 20  mail2.example.com   ✓       │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ SPF Record                       │   │
│ │ v=spf1 include:_spf.google.com  │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ DMARC Policy                     │   │
│ │ p=quarantine; rua=...           │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

## ✨ Micro-Interactions

1. **Button Press:** Scale to 0.98, add intense glow
2. **Input Focus:** Green border glow pulsing subtly
3. **Log Entry Appear:** Slide in from left with fade
4. **Nav Item Active:** Left border grows from center
5. **Success Status:** Brief bright glow then settle
6. **Profile Switch:** Smooth crossfade

---

## 📱 Responsive Considerations

- Sidebar collapses to icons only below 800px
- Form panel stacks above logs on narrow screens
- Touch targets minimum 44px
- Maintain readable contrast ratios (WCAG AA)

---

## 🔒 Accessibility

- High contrast mode: Increase brightness of greens
- Reduce motion mode: Disable glow animations, scanlines
- Focus indicators: Strong visible outline (matrix green)
- Status colors: Use icons in addition to colors

---

## 📁 CSS Variable Summary

```css
:root, [data-theme="hacker"] {
  /* Backgrounds */
  --bg:             #0A0F0A;
  --bg-elevated:    #0D120D;
  --surface:        #111611;
  --surface-2:      #151A15;
  --surface-3:      #1A201A;
  
  /* Borders */
  --border:         #243024;
  --border-light:   #304030;
  
  /* Text */
  --text:           #E0FFE0;
  --text-secondary: #B8D4B8;
  --text-dim:       #708070;
  
  /* Accent (Matrix Green) */
  --accent:         #00FF41;
  --accent-hover:   #39FF14;
  --accent-dim:     rgba(0, 255, 65, 0.08);
  --accent-text:    #00FF41;
  
  /* Status */
  --success:        #00FF41;
  --success-dim:    rgba(0, 255, 65, 0.12);
  --warning:        #FFD700;
  --warning-dim:    rgba(255, 215, 0, 0.12);
  --error:          #FF3333;
  --error-dim:      rgba(255, 51, 51, 0.12);
  --info:           #00BFFF;
  --info-dim:       rgba(0, 191, 255, 0.12);
  
  /* Effects */
  --shadow:         0 2px 8px rgba(0, 0, 0, 0.5);
  --shadow-lg:      0 8px 32px rgba(0, 0, 0, 0.6);
  --glow:           0 0 10px rgba(0, 255, 65, 0.3);
  
  /* Typography */
  --font-mono:      "JetBrains Mono", "Fira Code", monospace;
  --font-sans:      "Inter", -apple-system, sans-serif;
  
  /* Sizing */
  --radius:         8px;
  --radius-sm:      6px;
  --radius-lg:      12px;
  --sidebar-w:      240px;
  --transition:     0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 🚀 Implementation Priority

1. **Phase 1:** Update CSS variables for new color scheme
2. **Phase 2:** Add glow effects to interactive elements
3. **Phase 3:** Style the log viewer with matrix aesthetics
4. **Phase 4:** Add subtle animations and micro-interactions
5. **Phase 5:** Optional scanlines and advanced effects

---

**Design By:** Claude AI for SMTP Lab
**Theme Name:** "Matrix Hacker"
**Version:** 1.0

