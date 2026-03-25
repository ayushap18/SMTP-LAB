# SMTP Lab - Hacker Theme UI Design

## Design Created in Pencil

The following UI components were successfully designed in Pencil:

### App Structure (1200 x 800)
```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────────────────────────────────────┐ │
│ │  SIDEBAR    │ │              MAIN AREA                      │ │
│ │  (240px)    │ │                                             │ │
│ │             │ │  ┌─────────────────────────────────────────┐│ │
│ │ ◈ SMTP Lab  │ │  │ [Test] [Batch] [Monitor]  <- TAB BAR   ││ │
│ │   [☀/☾]     │ │  └─────────────────────────────────────────┘│ │
│ │             │ │                                             │ │
│ │─────────────│ │  ┌──────────────┐ ┌───────────────────────┐│ │
│ │ ▸ Test    ◄─│ │  │ FORM PANEL   │ │     LOG PANEL        ││ │
│ │ ▹ Templates │ │  │   (420px)    │ │                       ││ │
│ │ ▹ History   │ │  │              │ │   ═══ LIVE LOGS ═══   ││ │
│ │ ▹ DNS Tools │ │  │ CONNECTION   │ │                       ││ │
│ │ ▹ Settings  │ │  │ [Host    ]   │ │   14:32:05 [OK] CONN  ││ │
│ │             │ │  │ [Port]       │ │   Connected to smtp...││ │
│ │─────────────│ │  │              │ │                       ││ │
│ │ PROFILES    │ │  │ AUTH         │ │   14:32:05 [OK] TLS   ││ │
│ │ ● Gmail   ◄─│ │  │ [Username]   │ │   STARTTLS success    ││ │
│ │ ○ Outlook   │ │  │ [••••••••]   │ │                       ││ │
│ │             │ │  │              │ │   14:32:06 [OK] AUTH  ││ │
│ │             │ │  │ MESSAGE      │ │   Authenticated as... ││ │
│ │─────────────│ │  │ [From][To]   │ │                       ││ │
│ │ v0.1.0      │ │  │              │ │   14:32:06 [INFO]     ││ │
│ │             │ │  │ [▶ SEND]     │ │   Sending email...    ││ │
│ └─────────────┘ │  └──────────────┘ └───────────────────────┘│ │
│                 │  ┌─────────────────────────────────────────┐│ │
│                 │  │ ● Connected | 128ms             STATUS ││ │
│                 │  └─────────────────────────────────────────┘│ │
│                 └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Color Variables Set in Pencil

The following hacker theme variables were configured:

| Variable | Value | Description |
|----------|-------|-------------|
| `--bg` | #0A0F0AFF | Main dark background |
| `--bg-elevated` | #0D120DFF | Elevated surfaces |
| `--surface` | #111611FF | Cards, sidebar |
| `--surface-2` | #151A15FF | Input backgrounds |
| `--surface-3` | #1A201AFF | Hover states |
| `--border` | #1E2A1EFF | Dark borders |
| `--border-light` | #2A3D2AFF | Lighter borders |
| `--text` | #D0F0D0FF | Primary text (green-tinted white) |
| `--text-secondary` | #A8C8A8FF | Secondary text |
| `--text-dim` | #507050FF | Muted text |
| `--accent` | #00FF41FF | Matrix green (primary) |
| `--accent-hover` | #39FF14FF | Neon green (hover) |
| `--accent-dim` | #00FF4120 | Transparent green |
| `--success` | #00FF41FF | Success state |
| `--warning` | #FFD700FF | Warning amber |
| `--error` | #FF3333FF | Error red |
| `--info` | #00BFFFFF | Info cyan |

## Components Designed

### 1. Sidebar (240px width)
- **Header**: Logo "◈ SMTP Lab" with matrix green glow, theme toggle button
- **Navigation**: 5 items (Test, Templates, History, DNS Tools, Settings)
  - Active item: Green background tint, 3px green left border, green text
  - Inactive items: Dim text, transparent background
- **Divider**: 1px border line
- **Profiles Section**: Header + profile list
  - Active profile: Green dot, green text, tinted background
  - Inactive profile: Dim dot, secondary text

### 2. Main Area
- **Tab Bar**: Horizontal tabs with active indicator line
- **Split View**: Form panel (420px) + Log panel (flexible)

### 3. Form Panel
- **Section Labels**: Uppercase, dim color, 11px semibold
- **Input Fields**: 
  - Background: surface-2
  - Corner radius: 6px
  - Font: JetBrains Mono
  - Focus: Green border + glow
- **Buttons**:
  - Primary (Send): Green fill, black text, bold
  - Secondary (Diagnose): Surface-2 fill, secondary text

### 4. Log Panel
- **Toolbar**: "LIVE LOGS" title in green, action buttons
- **Log Entries**: Terminal-style formatting
  - Timestamp: Dim color, 11px mono
  - Level badge: [OK] green, [INFO] cyan, [WARN] amber, [ERR] red
  - Stage: Green, semibold
  - Message: Primary text color

### 5. Status Bar
- Status indicator dot (green when connected)
- Latency display
- Additional info

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Logo | JetBrains Mono | 16px | Bold |
| Nav items | Inter | 13px | Medium/Semibold |
| Section labels | Inter | 11px | Semibold |
| Input text | JetBrains Mono | 13px | Normal |
| Buttons | Inter | 13px | Bold/Semibold |
| Log entries | JetBrains Mono | 11-12px | Normal/Bold |

## To Complete This Design

The Pencil session was interrupted. To view/continue the design:

1. Open VS Code with Pencil extension
2. Open the `.pen` file that was being edited (should be in recent files)
3. The design structure should be preserved

Or apply the CSS theme file: `docs/design/hacker-theme.css`

