# LearnGraph Design System

> **Version:** 1.0  
> **Last Updated:** March 7, 2026  
> **Stack:** Next.js 16 · shadcn/ui · Tailwind CSS v4 · Radix Primitives  
> **Principle:** Scholarly warmth meets modern clarity

---

## 1. Design Philosophy

LearnGraph is a place where knowledge compounds. The design must feel **focused but not sterile**, **data-rich but not overwhelming**, and **motivating without being gamified into distraction**. Every pixel serves the learning loop: ingest → understand → practice → retain → master.

### Design Pillars

| Pillar | Meaning | In Practice |
|--------|---------|-------------|
| **Clarity** | Reduce cognitive load — the content is already demanding | Generous whitespace, clear hierarchy, restrained color use |
| **Trust** | Users entrust their learning to us | Consistent patterns, predictable navigation, honest progress metrics |
| **Momentum** | Learning requires sustained effort | Streak visualizations, micro-celebrations, smooth transitions |
| **Depth** | Power users need density; new users need simplicity | Progressive disclosure, collapsible panels, information layers |

---

## 2. Brand Identity

### Logo Usage

- **Wordmark:** "LearnGraph" — one word, capital L and G
- **Icon mark:** An abstract node-and-edge motif forming a stylized brain/constellation shape
- **Minimum clear space:** 1× the height of the "L" on all sides
- **Minimum size:** 24px height (icon), 80px width (wordmark)

### Voice & Tone

| Context | Tone | Example |
|---------|------|---------|
| Onboarding | Warm, encouraging | "Let's map out what you know — and what's next." |
| Mentor chat | Socratic, patient | "Good start. What happens if we increase the learning rate?" |
| Review nudge | Motivating, concise | "4 concepts are fading — 3 minutes keeps them sharp." |
| Error state | Honest, helpful | "We couldn't process this file. Try uploading a PDF under 50 MB." |
| Achievement | Celebratory, restrained | "Mastered: Gradient Descent. That's 12 concepts this week." |

---

## 3. Color System

### 3.1 Core Palette

Built for Tailwind CSS. All values are HSL for seamless shadcn/ui integration.

#### Light Mode

```css
:root {
  /* ── Brand ── */
  --brand-primary:        222 62% 52%;    /* #3164BE — Deep Academic Blue */
  --brand-primary-hover:  222 62% 45%;
  --brand-primary-subtle: 222 62% 96%;
  --brand-secondary:      162 60% 42%;    /* #2BAA7E — Knowledge Green */
  --brand-secondary-hover:162 60% 36%;
  --brand-accent:         32  95% 58%;    /* #F5A623 — Warm Amber */

  /* ── Surfaces ── */
  --background:           220 20% 98%;    /* #F8F9FB — Warm off-white */
  --foreground:           224 28% 12%;    /* #16192B — Near-black with warmth */
  --card:                 0   0%  100%;
  --card-foreground:      224 28% 12%;
  --muted:                220 14% 94%;    /* #EDEEF2 */
  --muted-foreground:     220 10% 46%;

  /* ── Borders & Dividers ── */
  --border:               220 14% 89%;
  --border-strong:        220 14% 78%;
  --ring:                 222 62% 52%;

  /* ── Semantic ── */
  --success:              152 56% 42%;    /* #30A869 — Mastered */
  --success-subtle:       152 56% 95%;
  --warning:              38  92% 50%;    /* #F5A623 — Decaying */
  --warning-subtle:       38  92% 95%;
  --destructive:          0   72% 51%;    /* #D93636 — Failed / Gap */
  --destructive-subtle:   0   72% 96%;
  --info:                 210 80% 56%;    /* #3B82F6 — In Progress */
  --info-subtle:          210 80% 96%;
}
```

#### Dark Mode

```css
.dark {
  --brand-primary:        222 62% 62%;
  --brand-primary-hover:  222 62% 70%;
  --brand-primary-subtle: 222 40% 16%;
  --brand-secondary:      162 50% 52%;
  --brand-secondary-hover:162 50% 60%;
  --brand-accent:         32  90% 62%;

  --background:           224 28% 7%;     /* #0E1118 */
  --foreground:           220 14% 92%;
  --card:                 224 24% 10%;
  --card-foreground:      220 14% 92%;
  --muted:                224 20% 14%;
  --muted-foreground:     220 10% 56%;

  --border:               224 20% 18%;
  --border-strong:        224 20% 28%;
  --ring:                 222 62% 62%;

  --success:              152 50% 50%;
  --success-subtle:       152 40% 12%;
  --warning:              38  85% 55%;
  --warning-subtle:       38  60% 12%;
  --destructive:          0   65% 58%;
  --destructive-subtle:   0   50% 12%;
  --info:                 210 75% 62%;
  --info-subtle:          210 50% 12%;
}
```

### 3.2 Mastery Level Colors

Used in knowledge graph nodes, progress indicators, and badges.

| Level | Name | Light | Dark | Tailwind Token |
|-------|------|-------|------|----------------|
| 0 | Unknown | `hsl(220 10% 80%)` | `hsl(220 10% 30%)` | `mastery-0` |
| 1 | Exposed | `hsl(210 80% 56%)` | `hsl(210 75% 62%)` | `mastery-1` |
| 2 | Practicing | `hsl(270 60% 58%)` | `hsl(270 55% 65%)` | `mastery-2` |
| 3 | Familiar | `hsl(38 92% 50%)` | `hsl(38 85% 55%)` | `mastery-3` |
| 4 | Proficient | `hsl(152 56% 42%)` | `hsl(152 50% 50%)` | `mastery-4` |
| 5 | Mastered | `hsl(162 60% 42%)` | `hsl(162 50% 52%)` | `mastery-5` |

### 3.3 Gradients

```css
/* Hero / CTA backgrounds */
.gradient-brand {
  background: linear-gradient(135deg, hsl(222 62% 52%), hsl(262 52% 52%));
}

/* Knowledge graph background glow */
.gradient-graph {
  background: radial-gradient(ellipse at center, hsl(222 62% 96%), transparent 70%);
}

/* Streak flame (achievement moments) */
.gradient-streak {
  background: linear-gradient(180deg, hsl(32 95% 58%), hsl(0 72% 51%));
}

/* Card shimmer for loading states */
.gradient-shimmer {
  background: linear-gradient(
    90deg,
    hsl(220 14% 94%) 0%,
    hsl(220 14% 98%) 50%,
    hsl(220 14% 94%) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

---

## 4. Typography

### 4.1 Font Stack

| Role | Font | Weight Range | Fallback | Rationale |
|------|------|-------------|----------|-----------|
| **Headings** | **Inter** | 600–700 | `system-ui, -apple-system, sans-serif` | Geometric precision, excellent legibility at all sizes, variable font for performance |
| **Body** | **Inter** | 400–500 | `system-ui, -apple-system, sans-serif` | Same family for cohesion; designed for screens at small sizes |
| **Mono / Code** | **JetBrains Mono** | 400–500 | `'Fira Code', 'Cascadia Code', monospace` | Ligatures, clear distinction between similar chars (1/l/I, 0/O) |
| **Mentor Chat (AI)** | **Source Serif 4** | 400–600 | `Georgia, 'Times New Roman', serif` | Serif warmth differentiates AI voice from UI; scholarly feel |

**Alternative heading option for a warmer feel:**  
Swap Inter headings for **Plus Jakarta Sans** (weight 600–800) — slightly rounder terminals, friendlier personality while maintaining professionalism.

**Loading strategy:**

```html
<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/inter-var-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/source-serif-4-var-latin.woff2" as="font" type="font/woff2" crossorigin />
```

### 4.2 Type Scale

Based on a **1.250 ratio (Major Third)** for harmonious scaling. All values in `rem` (base = 16px).

| Token | Size | Line Height | Letter Spacing | Weight | Usage |
|-------|------|-------------|----------------|--------|-------|
| `display-xl` | 3.052rem (48.8px) | 1.1 | -0.02em | 700 | Landing page hero |
| `display` | 2.441rem (39.1px) | 1.15 | -0.02em | 700 | Page titles |
| `h1` | 1.953rem (31.3px) | 1.2 | -0.015em | 600 | Section headers |
| `h2` | 1.563rem (25px) | 1.25 | -0.01em | 600 | Card titles, panel headers |
| `h3` | 1.25rem (20px) | 1.35 | -0.005em | 600 | Sub-sections |
| `h4` | 1rem (16px) | 1.4 | 0 | 600 | Labels, list headers |
| `body-lg` | 1.125rem (18px) | 1.6 | 0 | 400 | Mentor chat AI responses, long-form reading |
| `body` | 1rem (16px) | 1.6 | 0 | 400 | Default body text |
| `body-sm` | 0.875rem (14px) | 1.5 | 0.005em | 400 | Secondary text, metadata |
| `caption` | 0.75rem (12px) | 1.4 | 0.01em | 500 | Timestamps, labels, badges |
| `overline` | 0.6875rem (11px) | 1.3 | 0.08em | 600 | ALL-CAPS section labels |
| `code` | 0.875rem (14px) | 1.5 | 0 | 400 | Inline code, code blocks |

### 4.3 Tailwind v4 Typography Config

Tailwind v4 uses the CSS-native `@theme` directive instead of `tailwind.config.ts`. Define fonts and type scale in your main CSS file:

```css
/* app.css (or globals.css) */
@import "tailwindcss";

@theme {
  /* ── Fonts ── */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* ── Type Scale (Major Third — 1.250 ratio) ── */
  --text-display-xl: 3.052rem;
  --text-display-xl--line-height: 1.1;
  --text-display-xl--letter-spacing: -0.02em;

  --text-display: 2.441rem;
  --text-display--line-height: 1.15;
  --text-display--letter-spacing: -0.02em;

  --text-h1: 1.953rem;
  --text-h1--line-height: 1.2;
  --text-h1--letter-spacing: -0.015em;

  --text-h2: 1.563rem;
  --text-h2--line-height: 1.25;
  --text-h2--letter-spacing: -0.01em;

  --text-h3: 1.25rem;
  --text-h3--line-height: 1.35;
  --text-h3--letter-spacing: -0.005em;

  --text-body-lg: 1.125rem;
  --text-body-lg--line-height: 1.6;

  --text-body-sm: 0.875rem;
  --text-body-sm--line-height: 1.5;
  --text-body-sm--letter-spacing: 0.005em;

  --text-caption: 0.75rem;
  --text-caption--line-height: 1.4;
  --text-caption--letter-spacing: 0.01em;

  --text-overline: 0.6875rem;
  --text-overline--line-height: 1.3;
  --text-overline--letter-spacing: 0.08em;
}
```

This generates utility classes like `font-sans`, `font-serif`, `font-mono`, `text-display-xl`, `text-h1`, etc.

---

## 5. Spacing & Layout

### 5.1 Spacing Scale

Using Tailwind's default 4px base unit. Key application-level tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `space-page` | 24px (`p-6`) / 32px (`p-8`) on desktop | Page-level padding |
| `space-section` | 48px (`gap-12`) | Between major page sections |
| `space-card` | 20px (`p-5`) / 24px (`p-6`) | Internal card padding |
| `space-stack` | 16px (`gap-4`) | Between stacked elements (cards in a list) |
| `space-inline` | 8px (`gap-2`) | Between inline elements (icon + label) |
| `space-tight` | 4px (`gap-1`) | Between tightly related elements (badge group) |

### 5.2 Grid System

```
┌─────────────────────────────────────────────────────────────────────┐
│  Container: max-w-7xl (1280px) · mx-auto · px-4 sm:px-6 lg:px-8   │
│                                                                     │
│  ┌─ Sidebar ──┐  ┌─ Main Content ──────────────────────────────┐   │
│  │  w-64      │  │  flex-1 · min-w-0                           │   │
│  │  (256px)   │  │                                              │   │
│  │  fixed on  │  │  Content area uses a 12-column grid:        │   │
│  │  desktop,  │  │  grid grid-cols-12 gap-6                    │   │
│  │  drawer on │  │                                              │   │
│  │  mobile    │  │  Common layouts:                             │   │
│  │            │  │  · Full: col-span-12                         │   │
│  │            │  │  · Main+Side: col-span-8 + col-span-4       │   │
│  │            │  │  · Three-col: col-span-4 × 3                │   │
│  │            │  │                                              │   │
│  └────────────┘  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Breakpoints

| Name | Width | Typical Device | Layout Change |
|------|-------|----------------|---------------|
| `sm` | 640px | Large phones (landscape) | Stack to single column |
| `md` | 768px | Tablets (portrait) | Sidebar becomes drawer |
| `lg` | 1024px | Tablets (landscape), small laptops | Sidebar visible |
| `xl` | 1280px | Laptops, desktops | Max-width container kicks in |
| `2xl` | 1536px | Large displays | Wider content area, more graph nodes visible |

---

## 6. Component Patterns

All components extend **shadcn/ui** primitives. Below are LearnGraph-specific patterns.

### 6.1 Buttons

| Variant | Class | Usage |
|---------|-------|-------|
| **Primary** | `bg-brand-primary text-white hover:bg-brand-primary-hover` | Main CTA: "Start Review", "Upload" |
| **Secondary** | `bg-transparent border border-border text-foreground hover:bg-muted` | Secondary actions: "Skip", "View Details" |
| **Ghost** | `bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground` | Tertiary: "Cancel", navigation items |
| **Success** | `bg-success text-white hover:bg-success/90` | Positive confirm: "Mark as Mastered" |
| **Destructive** | `bg-destructive text-white hover:bg-destructive/90` | Danger: "Delete Content", "Reset Progress" |

**Sizes:**

| Size | Padding | Font | Height | Use |
|------|---------|------|--------|-----|
| `sm` | `px-3 py-1.5` | `text-body-sm` | 32px | Inline actions, badges |
| `default` | `px-4 py-2` | `text-body` | 40px | Standard buttons |
| `lg` | `px-6 py-3` | `text-body-lg` | 48px | Hero CTAs, mobile touch targets |
| `icon` | `p-2` | — | 40px | Icon-only buttons |

**Border radius:** `rounded-lg` (8px) for all buttons. `rounded-full` for icon-only and pill badges.

### 6.2 Cards

```
┌──────────────────────────────────────────┐
│  ┌──────┐                                │ ← rounded-xl (12px)
│  │ Icon │  Title Text              Badge │ ← p-5 internal padding
│  └──────┘  Subtitle / metadata           │
│                                          │
│  Body content area. Can contain text,    │ ← border border-border
│  charts, lists, or nested components.    │   bg-card
│                                          │   shadow-sm (light mode)
│  ┌───────────┐  ┌───────────────────┐    │   shadow-none (dark mode)
│  │ Secondary │  │    Primary CTA    │    │
│  └───────────┘  └───────────────────┘    │
└──────────────────────────────────────────┘
```

**Card Variants:**

| Variant | Border | Shadow | Background | Use Case |
|---------|--------|--------|------------|----------|
| Default | `border` | `shadow-sm` | `bg-card` | Content library items, quiz cards |
| Elevated | `border` | `shadow-md` | `bg-card` | Modals, dropdown menus, popovers |
| Interactive | `border hover:border-brand-primary hover:shadow-md` | `shadow-sm` | `bg-card` | Clickable cards (select content, concept node) |
| Concept | `border-l-4 border-l-mastery-{level}` | `shadow-sm` | `bg-card` | Knowledge graph concept detail |
| Inset | none | none | `bg-muted` | Nested information within a card |

### 6.3 Input Fields

```
Label Text (caption, font-medium, text-foreground)
┌──────────────────────────────────────────┐
│  Placeholder text...                     │ ← h-10, rounded-lg, border
└──────────────────────────────────────────┘
  Helper text (caption, text-muted-foreground)
```

- **Focus ring:** `ring-2 ring-ring ring-offset-2`
- **Error state:** `border-destructive` + error message in `text-destructive`
- **Disabled:** `opacity-50 cursor-not-allowed`

### 6.4 Chat / Mentor Interface

```
┌─────────────────────────────────────────────────────────────┐
│  AI Mentor · Gradient Descent                    [⋯] [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌──────────────────────────────────┐                │
│         │ User message — body font,        │  ← bg-brand-primary/10
│         │ right-aligned, rounded-2xl       │    rounded-br-sm
│         └──────────────────────────────────┘    max-w-[80%]
│                                                             │
│  ┌──────────────────────────────────────┐                   │
│  │ AI response — serif font (Source     │  ← bg-muted
│  │ Serif 4), left-aligned,             │    rounded-bl-sm
│  │ rounded-2xl, body-lg size           │    max-w-[80%]
│  │                                      │
│  │ > "Think about what happens when    │  ← blockquotes for
│  │   the learning rate is too large..." │    Socratic prompts
│  │                                      │
│  │ 📎 Source: Chapter 4, p.23          │  ← grounding citation
│  └──────────────────────────────────────┘    text-caption, clickable
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐  ┌──────┐ │
│  │  Ask about this concept...                  │  │  ↑   │ │
│  └─────────────────────────────────────────────┘  └──────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Knowledge Graph Node

```
        ┌─────────────────┐
        │  ◉ Concept Name │  ← Circle: fill = mastery color
        │  ★★★☆☆  3/5     │    Border: stroke-width scales with importance
        └─────────────────┘    Size: scales with downstream dependency count
              │
    ┌─────────┼─────────┐      Edges:
    │         │         │      - prerequisite: solid line, arrow
    ▼         ▼         ▼      - related_to: dashed line, no arrow
  [Node]   [Node]   [Node]    - part_of: dotted line, diamond head
```

**Node states:**

| State | Visual |
|-------|--------|
| Unknown (0) | Gray fill, 40% opacity, smallest size |
| In progress | Pulsing ring animation, info-blue border |
| Mastered (5) | Full green fill, subtle glow, checkmark overlay |
| Decaying | Warning-amber border, fade animation |
| Gap detected | Destructive-red dashed border, exclamation badge |

---

## 7. Iconography

### Icon Library

**Primary:** [Lucide Icons](https://lucide.dev/) — consistent stroke width (1.5px default), MIT licensed, tree-shakeable, already bundled with shadcn/ui.

### Application-Specific Icons

| Icon | Lucide Name | Usage |
|------|-------------|-------|
| Upload | `Upload` | Content upload CTA |
| Brain | `Brain` | Knowledge graph, AI mentor |
| BookOpen | `BookOpen` | Learning objects, content library |
| Zap | `Zap` | Daily review, quick actions |
| Target | `Target` | Learning goals, gap detection |
| Trophy | `Trophy` | Achievements, mastered concepts |
| Flame | `Flame` | Study streak |
| BarChart3 | `BarChart3` | Analytics, progress |
| Network | `Network` | Knowledge graph view |
| GraduationCap | `GraduationCap` | Curriculum, courses |
| MessageCircle | `MessageCircle` | Mentor chat |
| Repeat | `Repeat` | Spaced repetition / review |
| CheckCircle2 | `CheckCircle2` | Correct answer, mastered |
| XCircle | `XCircle` | Incorrect answer, gap |
| Clock | `Clock` | Scheduled review, time estimate |
| Sparkles | `Sparkles` | AI-generated content indicator |

### Icon Sizing

| Context | Size | Tailwind |
|---------|------|----------|
| Inline with text | 16px | `w-4 h-4` |
| Button with label | 18px | `w-[18px] h-[18px]` |
| Card header | 20px | `w-5 h-5` |
| Empty state | 48px | `w-12 h-12` |
| Hero illustration | 64px+ | `w-16 h-16` |

---

## 8. Motion & Animation

### Principles

1. **Purposeful** — motion communicates state change, not decoration
2. **Fast** — most transitions under 200ms; nothing blocks user flow
3. **Physics-based** — ease-out for entries, ease-in for exits, spring for interactions

### Duration Scale

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `instant` | 100ms | `ease-out` | Hover states, active states |
| `fast` | 150ms | `ease-out` | Tooltips, dropdowns, tab switches |
| `normal` | 200ms | `ease-in-out` | Card expand, sidebar toggle |
| `slow` | 300ms | `ease-in-out` | Modal open/close, page transitions |
| `deliberate` | 500ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Knowledge graph node transitions |

### Key Animations

```css
/* Mentor chat: AI response streaming */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.ai-cursor {
  animation: cursor-blink 1s step-end infinite;
}

/* Knowledge graph node pulse (in-progress concept) */
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 hsl(var(--info) / 0.5); }
  70% { box-shadow: 0 0 0 8px hsl(var(--info) / 0); }
  100% { box-shadow: 0 0 0 0 hsl(var(--info) / 0); }
}

/* Mastery level-up celebration */
@keyframes level-up {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* Review card flip */
@keyframes card-flip {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}

/* Streak flame flicker */
@keyframes flame {
  0%, 100% { transform: scaleY(1) rotate(-1deg); }
  50% { transform: scaleY(1.05) rotate(1deg); }
}

/* Skeleton loading shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Layout Templates

### 9.1 Dashboard (Home)

```
┌─ Sidebar ─┐ ┌─ Main ─────────────────────────────────────────────┐
│            │ │                                                     │
│ ◉ Home    │ │  Good morning, Alex.          [Streak: 🔥 12 days] │
│ □ Library │ │                                                     │
│ 💬 Mentor │ │  ┌─ Daily Review ──────┐  ┌─ Knowledge Snapshot ──┐ │
│ ⚡ Review  │ │  │ 8 concepts due      │  │   ◉──◉──◉            │ │
│ 🎯 Goals  │ │  │ Est. 6 minutes      │  │  /  \   \            │ │
│ 📊 Stats  │ │  │                     │  │ ◉    ◉   ◉           │ │
│ 🌐 Graph  │ │  │ [Start Review →]    │  │ Mini graph preview    │ │
│            │ │  └─────────────────────┘  └───────────────────────┘ │
│ ─────────  │ │                                                     │
│ Recent:    │ │  ┌─ Recent Content ──────────────────────────────┐  │
│ · ML Basics│ │  │  📄 ML Basics.pdf          85% processed     │  │
│ · Stats 101│ │  │  🎬 Lecture 4 — YouTube    12 concepts       │  │
│            │ │  │  📑 Stats Notes.pptx       3 quizzes ready   │  │
│            │ │  └───────────────────────────────────────────────┘  │
└────────────┘ └─────────────────────────────────────────────────────┘
```

### 9.2 Content Detail / Study View

```
┌─ Sidebar ─┐ ┌─ Content Panel (col-span-8) ──┐ ┌─ Side (col-span-4) ──┐
│            │ │                                │ │                       │
│            │ │  ML Basics.pdf                 │ │  CONCEPTS (12)        │
│            │ │  ───────────────               │ │  ┌────────────────┐   │
│            │ │  Tab: [Summary] [Full] [Notes] │ │  │ ◉ Neural Nets  │   │
│            │ │                                │ │  │   ★★★☆☆        │   │
│            │ │  ## TL;DR                      │ │  ├────────────────┤   │
│            │ │  This document covers the      │ │  │ ◉ Backprop     │   │
│            │ │  fundamentals of...            │ │  │   ★★☆☆☆        │   │
│            │ │                                │ │  ├────────────────┤   │
│            │ │  ## Key Points                 │ │  │ ◉ Loss Funcs   │   │
│            │ │  • Point one                   │ │  │   ★☆☆☆☆  ⚠    │   │
│            │ │  • Point two                   │ │  └────────────────┘   │
│            │ │  • Point three                 │ │                       │
│            │ │                                │ │  ACTIONS               │
│            │ │                                │ │  [💬 Ask Mentor]       │
│            │ │                                │ │  [⚡ Quick Quiz]       │
│            │ │                                │ │  [📝 Flashcards]      │
│            │ │                                │ │                       │
└────────────┘ └────────────────────────────────┘ └───────────────────────┘
```

### 9.3 Review Session

```
┌──────────────────────────────────────────────────────────────┐
│  Review Session · 5 of 12                    [×] Close      │
│  ████████████░░░░░░░░  42%                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│           What is the purpose of a loss function             │
│           in neural network training?                        │
│                                                              │
│           Concept: Loss Functions · Difficulty: 3/5          │
│                                                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Type your answer...                                 │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│         [Show Hint]              [Submit Answer →]           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ← Again (1)    Hard (2)    Good (3)    Easy (4) →          │
│  < 1 min        < 6 min     < 1 day     4 days              │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Dark Mode Strategy

- Default: **system preference** via `prefers-color-scheme`
- User override: toggle in settings (persisted to `preferences` JSONB)
- Implementation: Tailwind `darkMode: 'class'` + next-themes
- All colors defined as CSS custom properties (Section 3) — single source of truth
- Images and illustrations: use `opacity-90` in dark mode; never invert
- Knowledge graph: slightly reduce node saturation in dark mode for reduced eye strain
- Code blocks: use a dedicated syntax theme per mode (e.g., One Light / One Dark)

---

## 11. Accessibility

### Standards

- **Target:** WCAG 2.2 Level AA minimum
- **Contrast ratios:** All text meets 4.5:1 (normal) / 3:1 (large text) against its background
- **Focus indicators:** Visible 2px ring on all interactive elements (`ring-2 ring-ring ring-offset-2`)
- **Keyboard navigation:** Full tab order, arrow-key navigation in lists and graph, Escape to close modals
- **Screen readers:** All icons have `aria-label`, decorative icons use `aria-hidden="true"`, live regions for AI streaming responses

### Semantic HTML Priorities

| Component | Element |
|-----------|---------|
| Navigation sidebar | `<nav aria-label="Main navigation">` |
| Content sections | `<article>`, `<section>` with headings |
| Mentor chat | `<div role="log" aria-live="polite">` for AI responses |
| Review cards | `<form>` with fieldset for answer options |
| Progress bars | `<progress>` or `role="progressbar"` with `aria-valuenow` |
| Knowledge graph | `role="img"` with `aria-label` summary + tabular alternative view |

---

## 12. Responsive Behavior Summary

| Component | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|-----------|-----------------|--------------------|--------------------|
| Sidebar | Bottom tab bar (5 items) | Collapsed icon rail (expand on hover) | Full sidebar (256px) |
| Dashboard cards | Single column stack | 2-column grid | 2–3 column grid |
| Mentor chat | Full-screen overlay | Side panel (50%) | Side panel (400px fixed) |
| Knowledge graph | Horizontal scroll, pinch-zoom | Full-width, controls overlay | Contained panel with zoom controls |
| Review session | Full-screen, large touch targets | Centered card (max-w-2xl) | Centered card (max-w-2xl) |
| Content detail | Tabbed (summary/concepts/actions) | Main + collapsible side | Two-column (8/4 split) |

---

## 13. Design Tokens Reference (Tailwind v4)

All project-specific tokens are defined via the `@theme` directive in your main CSS file. No `tailwind.config.ts` is needed — Tailwind v4 is CSS-native.

```css
/* app.css — place after @import "tailwindcss" and :root variables (Section 3) */

@theme {
  /* ── Brand Colors (reference :root CSS variables) ── */
  --color-brand-primary: hsl(var(--brand-primary));
  --color-brand-primary-hover: hsl(var(--brand-primary-hover));
  --color-brand-primary-subtle: hsl(var(--brand-primary-subtle));
  --color-brand-secondary: hsl(var(--brand-secondary));
  --color-brand-secondary-hover: hsl(var(--brand-secondary-hover));
  --color-brand-accent: hsl(var(--brand-accent));

  /* ── Mastery Level Colors ── */
  --color-mastery-0: hsl(var(--mastery-0));
  --color-mastery-1: hsl(var(--mastery-1));
  --color-mastery-2: hsl(var(--mastery-2));
  --color-mastery-3: hsl(var(--mastery-3));
  --color-mastery-4: hsl(var(--mastery-4));
  --color-mastery-5: hsl(var(--mastery-5));

  /* ── Semantic Colors ── */
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --color-info: hsl(var(--info));

  /* ── Border Radius ── */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-badge: 9999px;
  --radius-chat: 16px;

  /* ── Shadows ── */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06);
  --shadow-card-hover: 0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
  --shadow-elevated: 0 8px 24px 0 rgb(0 0 0 / 0.12);
  --shadow-glow-brand: 0 0 20px 0 hsl(222 62% 52% / 0.2);
  --shadow-glow-success: 0 0 16px 0 hsl(152 56% 42% / 0.25);

  /* ── Animations ── */
  --animate-cursor-blink: cursor-blink 1s step-end infinite;
  --animate-pulse-ring: pulse-ring 2s ease-out infinite;
  --animate-level-up: level-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-card-flip: card-flip 0.5s ease-in-out;
  --animate-flame: flame 0.6s ease-in-out infinite;
  --animate-shimmer: shimmer 1.5s ease-in-out infinite;
}
```

This generates utility classes like `bg-brand-primary`, `text-mastery-3`, `rounded-card`, `shadow-elevated`, `animate-shimmer`, etc. — no JS config file required.

---

## 14. File Structure Convention

```
src/
├── styles/
│   ├── globals.css              # CSS custom properties (Section 3), base resets
│   └── fonts.ts                 # Font loader config (next/font)
├── components/
│   ├── ui/                      # shadcn/ui primitives (button, card, input, etc.)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── mobile-tab-bar.tsx
│   │   └── page-container.tsx
│   ├── mentor/
│   │   ├── chat-bubble.tsx      # AI vs user message variants
│   │   ├── chat-input.tsx
│   │   └── source-citation.tsx
│   ├── review/
│   │   ├── review-card.tsx
│   │   ├── fsrs-buttons.tsx     # Again / Hard / Good / Easy
│   │   └── progress-bar.tsx
│   ├── graph/
│   │   ├── graph-canvas.tsx     # D3/react-force-graph wrapper
│   │   ├── concept-node.tsx
│   │   └── concept-detail.tsx
│   └── shared/
│       ├── mastery-badge.tsx
│       ├── streak-counter.tsx
│       └── empty-state.tsx
└── lib/
    └── design-tokens.ts         # Exported JS constants matching CSS vars
```

---

*This design system is a living document. Update it as the product evolves. Every new component should reference these tokens — no magic numbers, no one-off colors.*
