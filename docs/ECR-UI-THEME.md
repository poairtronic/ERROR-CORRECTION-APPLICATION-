# ECR UI Theme — Design Language Specification

**System:** Enterprise Quality Report (ECR) Digitization System
**Source of truth:** `frontend/src/index.css`
**Conventions:** `frontend/GEMINI.md`
**Extracted from:** production CSS (1,396 lines) + frontend styling rules

---

## 1. Design Overview

The ECR frontend uses a **premium dark, Linear-inspired** aesthetic built on **glassmorphism**. The system is defined entirely through **vanilla CSS custom properties** declared in `:root` inside `frontend/src/index.css`. Per `frontend/GEMINI.md`:

- All colors/styling must use CSS variables — **no inline hardcoded hex values** (except dynamic position calculations).
- **No Tailwind CSS** — clean, modular vanilla CSS or styled CSS modules.
- Loading states must use stylized SVG skeletons or CSS spinners, never raw "Loading..." text.
- Visual feedback via `react-hot-toast` for success/error outcomes.
- Responsive grids using `display: grid` with `repeat(auto-fit, minmax(..., 1fr))` and flex layouts.

### Core aesthetic pillars

| Pillar | Implementation |
|---|---|
| Dark neutral surface | `#0d0f12` base, `#15181e` cards |
| Glassmorphism | `backdrop-filter: blur(12–16px)` + translucent gradient fills |
| Depth | Layered shadows, top-edge highlight borders, inset highlights |
| Motion | Spring-like cubic-bezier easing, staggered grid entrances |
| Sheen sweep | Skewed light-sweep that glides across cards on hover |

---

## 2. Color Palette (Design Tokens)

Defined in `index.css:8-46` (`:root`).

### 2.1 Brand / Primary

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#5e6ad2` | Primary buttons, active nav indicator, focus rings, avatars, logo hex |
| `--primary-dark` | `#4d56b3` | Primary button hover |
| `--primary-light` | `#7a85e6` | "review" badge text, accent text |

Primary focus ring uses `rgba(94, 106, 210, 0.25)` (2px); active tab glow `rgba(94,106,210,0.4)`; avatar glow `rgba(94,106,210,0.3–0.4)`.

### 2.2 Semantic Status Colors

Each status has a base color plus translucent `-bg` (0.1 alpha) and `-border` (0.2 alpha) variants for badges and alerts.

| Status | Base | `-bg` | `-border` | Used for |
|---|---|---|---|---|
| Success | `#28a745` | `rgba(40,167,69,0.1)` | `rgba(40,167,69,0.2)` | `approved`, success states |
| Warning | `#f1a511` | `rgba(241,165,17,0.1)` | `rgba(241,165,17,0.2)` | `pending` |
| Danger | `#e24949` | `rgba(226,73,73,0.1)` | `rgba(226,73,73,0.2)` | `rejected`, logout hover, notifications, error alerts |

### 2.3 Neutral Surfaces

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0d0f12` | App background |
| `--bg-card` | `#15181e` | Cards, sidebar, modal, drawer |
| `--bg-card-hover` | `#1c2026` | Nav item hover |

### 2.4 Text

| Token | Value | Usage |
|---|---|---|
| `--text` | `#ecedef` | Primary text, table `strong` |
| `--text-muted` | `#8b929e` | Secondary text, table cells, nav items |
| `--text-dim` | `#6b7280` | Labels, timestamps, captions, placeholders |
| — | `#fff` | Stat values, headings, avatar text (hardcoded) |

### 2.5 Borders

| Token | Value | Usage |
|---|---|---|
| `--border` | `rgba(255,255,255,0.08)` | Default borders, dividers, table header rule |
| `--border-strong` | `rgba(255,255,255,0.15)` | Hovered/active borders, modal border |
| — | `rgba(255,255,255,0.03)` | Row dividers inside tables |
| — | `rgba(255,255,255,0.12)` | Card top highlight edge (glass effect) |

### 2.6 Badge Accent Colors (hardcoded variants)

| Role/State | Background | Foreground | Border |
|---|---|---|---|
| draft / closed | `rgba(139,146,158,0.1)` | `#9ca3af` | `rgba(139,146,158,0.2)` |
| review | `rgba(94,106,210,0.1)` | `#7a85e6` | `rgba(94,106,210,0.2)` |
| approval / gm | `rgba(168,85,247,0.1)` | `#c084fc` | `rgba(168,85,247,0.2)` |
| operator | `rgba(251,146,60,0.1)` | `#fb923c` | `rgba(251,146,60,0.2)` |
| inspector | `rgba(34,211,238,0.1)` | `#22d3ee` | `rgba(34,211,238,0.2)` |
| sm | `rgba(52,211,153,0.1)` | `#34d399` | `rgba(52,211,153,0.2)` |
| admin | `rgba(255,255,255,0.05)` | `#fff` | `rgba(255,255,255,0.1)` |

**Trend colors:** up `#34d399`, down `#f87171`, neutral `#9ca3af`.
**Login page glow:** radial gradients `rgba(94,106,210,0.1)` (top-left) and `rgba(168,85,247,0.05)` (bottom-right).

---

## 3. Glassmorphism Spec

The signature treatment. Two variants plus a translucent topbar.

### 3.1 Card / Stat-Card surface

```css
background: linear-gradient(145deg, rgba(30, 34, 42, 0.75), rgba(21, 24, 30, 0.45));
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.06);
border-top: 1px solid rgba(255, 255, 255, 0.12);   /* top highlight edge */
box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.5);
```

### 3.2 Glass panel (`.glass-panel`)

```css
background: rgba(21, 24, 30, 0.65);
backdrop-filter: blur(16px);         /* + -webkit- prefix */
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
border-radius: var(--radius-lg);
```

### 3.3 Glass card (`.glass-card`)

Same as 3.1 but with `rgba(30,34,42,0.7)` → `rgba(21,24,30,0.4)` gradient and hover elevation.

### 3.4 Sheen sweep (hover light sweep)

```css
.card::before, .stat-card::before, .glass-card::before {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
  transform: skewX(-25deg);
  transition: left 0.7s ease;
}
/* rest: left: -100% → 200% on hover */
```

### 3.5 Translucent topbar

```css
background: rgba(13, 15, 18, 0.85);
backdrop-filter: blur(12px);
```

### 3.6 Overlays / modals / drawers

| Element | Backdrop | Blur |
|---|---|---|
| Modal overlay | `rgba(0,0,0,0.7)` | `blur(8px)` |
| Sidebar overlay | `rgba(0,0,0,0.6)` | `blur(4px)` |
| Profile drawer backdrop | `rgba(0,0,0,0.6)` | `blur(4px)` |

---

## 4. Typography

- **Font family:** `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Antialiasing:** `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`

### Size scale

| Size | Weight | Context |
|---|---|---|
| 32px | 800 | Large KPI value (`.kpi-value-lg`) |
| 26px | 700 | Stat value |
| 24px | 700 | Medium KPI value (`.kpi-value-md`) |
| 20px | 600 | Login logo heading |
| 18px | 600 | Topbar title, modal title, drawer header |
| 15px | 700 | Sidebar logo |
| 14px | 600 | Card title; detail value (400) |
| 13px | 500 | Body, table cells, buttons, meta |
| 12px | 500–600 | Labels, stat-label, table headers |
| 11px | 600 | Nav section titles, detail labels, timeline time, badge labels |

### Letter-spacing conventions

- Negative tracking on headings/KPIs: `-0.2px`, `-0.3px`, `-0.5px`, `-1px`.
- `0.5px` for uppercase micro-labels (`.stat-label`, `.detail-label`, `.profile-info-label`).
- `text-transform: uppercase` on stat labels, detail labels, profile info labels, breadcrumbs.

### Gradient text (KPI)

```css
.kpi-value-lg {
  background: linear-gradient(90deg, #ffffff, #a5aab5);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 5. Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.4)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.5)` |
| `--shadow-lg` | `0 12px 24px rgba(0,0,0,0.6)` |
| `--shadow-inset` | `inset 0 1px 0 rgba(255,255,255,0.1)` |

**Hover elevation:** cards lift with `0 12px 32px -4px rgba(0,0,0,0.6)`.
**Ambient card shadow:** `0 4px 24px -4px rgba(0,0,0,0.5)`.
**Sidebar shadow:** `1px 0 20px rgba(0,0,0,0.2)`; drawer `-4px 0 24px rgba(0,0,0,0.5)`.
**Primary glow shadows:** `0 4px 12px rgba(94,106,210,0.4)` (logo hex, active tab).

---

## 6. Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Buttons, inputs, nav items, timeline notes, chips |
| `--radius-md` | 8px | Cards, stat cards, modal panels |
| `--radius-lg` | 12px | Modals, login card, glass panels |

**Pill radius `999px`:** badges, notification dot, notification badge.

---

## 7. Spacing & Layout

### 7.1 Core measures

| Measure | Value |
|---|---|
| Sidebar width `--sidebar-w` | 240px |
| Page content padding (desktop) | 32px |
| Topbar padding | 16px 32px |
| Card padding | 24px (16px tablet, 12px mobile) |
| Modal padding | 32px (20px tablet, 16px mobile) |
| Login card padding | 48px |

### 7.2 Gap rhythm

- Grid gaps: `8px` / `10px` / `12px` / `14px` / `16px` / `20px` / `24px`.
- Utility classes: `.gap-8`, `.gap-12`, `.gap-16`, `.mb-16`, `.mb-24`.
- Default gutter between grid columns: `20px` (forms), `16px` (stats), `24px` (dashboard).

### 7.3 Grid systems

- **Stats grid:** `repeat(auto-fit, minmax(200px, 1fr))`, gap 16px.
- **Form grid:** `1fr 1fr`, gap 20px (collapses to 1fr on mobile).
- **Dashboard grid:** 12-column (`grid-template-columns: repeat(12, 1fr)`), gap 24px; spans `3/4/6/8/12`.
- **Detail grid:** `1fr 1fr`, gap 24px.
- **Stage-costs grid:** `1fr 1fr`, gap 12px.

---

## 8. Animation Spec

### 8.1 Keyframes

| Name | Definition | Duration / Easing |
|---|---|---|
| `slideUp` (primary) | opacity 0→1, translateY(20px) scale(0.98)→(1) | 0.6s `cubic-bezier(0.16,1,0.3,1)` (cards/stat-cards); 0.3s modals |
| `slideInUp` | opacity 0→1, translateY(15px)→0 | 0.6s `cubic-bezier(0.16,1,0.3,1)` forwards |
| `fadeIn` | opacity 0→1 | 0.2s ease |
| `spin` | rotate 0→360deg | 0.8s `cubic-bezier(0.5,0,0.5,1)` infinite |
| skeleton shimmer | gradient `200% 100%` sweep | 1.5s infinite |

### 8.2 Easing curves

| Curve | Used for |
|---|---|
| `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances (slide up), drawer slide, sidebar off-canvas, modal sheet |
| `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Card/stat-card hover lift (springy overshoot) |
| `ease` | Shadow / border-color transitions, sheen sweep (0.7s) |
| `0.2s` default | Buttons, inputs, nav items, tabs |

### 8.3 Durations

| Duration | Context |
|---|---|
| 0.2s | Focus/active feedback, drawer fade |
| 0.3s | Modal slide, drawer slide, hover lift, card color shifts |
| 0.6s | Card entrance `slideUp` |
| 0.7s | Sheen sweep across card |
| 0.8s | Spinner rotation |

### 8.4 Staggered grid entrances

Child elements animate in sequence via `nth-child` delays:

- **Stats grid:** 50 / 150 / 250 / 350ms
- **Form grid:** 100 / 200 / 300 / 400ms
- **Dashboard grid:** 50 / 150 / 250 / 350 / 450ms
- Utility classes: `.delay-100` … `.delay-400`

### 8.5 Micro-interactions

- **Hover lift:** `translateY(-4px)` with springy cubic-bezier + shadow/border elevation.
- **Button press:** `transform: scale(0.98)` on `:active`.
- **Card sheen:** skewed white light sweeps `left: -100% → 200%` on hover.
- **Disabled buttons:** `opacity: 0.5; cursor: not-allowed; transform: none`.

---

## 9. Component Patterns

### 9.1 Buttons

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| `.btn-primary` | `var(--primary)` | `#fff` | inset white highlight | `--primary-dark` |
| `.btn-success` | `#1e3626` | `#4ade80` | `rgba(34,197,94,0.2)` | `#23452f`, text `#fff` |
| `.btn-danger` | `#3b1d1d` | `#f87171` | `rgba(239,68,68,0.2)` | `#4a2121`, text `#fff` |
| `.btn-ghost` | `rgba(255,255,255,0.03)` | `var(--text)` | `var(--border)` | `rgba(255,255,255,0.08)` |

Base: `8px 16px` padding, `--radius-sm`, 13px/500, `box-shadow: var(--shadow-sm)`. Sizes: `.btn-sm` = `6px 12px`.

### 9.2 Badges (status pills)

Inline-flex, `4px 10px`, radius `999px`, 11px/600, colored translucent fill + matching text/border. Status → style mapping in §2.6.

### 9.3 Form controls

`rgba(255,255,255,0.03)` fill, `var(--border)` border, `--radius-sm`, `10px 14px`, 13px. Hover → `0.05` fill + `--border-strong`. Focus → `0.05` fill, `--primary` border, **2px ring** `rgba(94,106,210,0.25)`, no outline. Select options use `--bg-card` / `--text`.

### 9.4 Modal

Overlay `rgba(0,0,0,0.7)` + `blur(8px)`, `fadeIn 0.2s`. Sheet: `--bg-card`, `--border-strong`, `--radius-lg`, max-width 560px, `max-height 90vh`, `slideUp 0.3s`. Mobile → bottom sheet (align-end, top-rounded).

### 9.5 Tables

Header 12px/600 `--text-dim`, cell 13px `--text-muted` (`strong` → `--text`), row dividers `rgba(255,255,255,0.03)`, hover row `rgba(255,255,255,0.02)` + text brighten. `border-spacing: 0`; scrollable wrapper with 8px custom scrollbar.

### 9.6 Skeleton & spinner

- Spinner: 32px, 2px `--border`, `--primary` top arc, `spin 0.8s`.
- Skeleton line: 12px shimmer `rgba(255,255,255,0.03→0.08→0.03)` at 200% width, `1.5s infinite`, radius 4px.

### 9.7 Timeline

8px dot (`--border-strong`, `0 0 0 4px var(--bg-card)` ring), 1px connector bars, event 13px/500 `#fff`, time 11px `--text-dim`, note 13px in `rgba(255,255,255,0.02)` chip.

### 9.8 Enterprise tabs

Segmented control: `rgba(0,0,0,0.2)` track + `rgba(255,255,255,0.05)` border; inactive 13px/600 `--text-muted`; active = `--primary` fill, `#fff`, glow `0 2px 8px rgba(94,106,210,0.4)`.

### 9.9 Profile drawer

350px right-side drawer (`--bg-card`, `--border`, `-4px 0 24px` shadow), slides `right: 0.3s cubic-bezier(0.16,1,0.3,1)`; backdrop fades with `blur(4px)`. Full-width on mobile.

### 9.10 Custom scrollbars

Desktop 8px / inner widgets 4px; thumb `rgba(255,255,255,0.1)` → `0.2` hover, radius 4px, transparent track.

---

## 10. Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| ≤ 1400px | Dashboard `col-span-3`→4, `col-span-4`→6 |
| ≤ 1024px | `col-span-3/4`→6, `col-span-8`→12 |
| ≤ 768px | Hamburger menu appears; sidebar off-canvas (`translateX(-100%)` + `sidebar-open`); overlay `blur(4px)`; single-column forms/detail/stage/dashboard grids; modal → bottom sheet; drawer full-width; stats 2-col; tables min-width 600px + horizontal scroll |
| ≤ 480px | Stats single column; tighter padding (`12px`), buttons `6px 10px`/11px, badges 10px, KPI 24px/20px, avatar 60px |

iOS-specific: focus targets get `scroll-margin-bottom: 200px` (tablet 250px/100px) so the keyboard doesn't hide inputs.

---

## 11. Print Styles

- Hide all navigation/controls: sidebar, topbar, buttons, `.no-print`, drawer, profile trigger.
- Flatten to B&W: `#fff` background, `#000` text, `#ddd` borders, badges outlined in black.
- Cards lose shadows/borders/padding; `.detail-grid` becomes single column; `.detail-field-row` becomes flex rows with dashed `#dddddd` underlines.
- `break-inside: avoid` + `page-break-inside: avoid` on cards/fields; modal/drawer hidden.
