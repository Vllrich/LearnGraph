# LearnGraph — New Features TODO (Market-Driven)

> **Status:** Tier 1 (1.1, 1.2, 1.3) shipped — Sprint 1 complete  
> **Last Updated:** March 8, 2026  
> **Source:** Market research (YouLearn.ai teardown, NotebookLM complaints, Reddit user feedback, competitive analysis)  
> **Reference:** [AI Startup Research](./AI_STARTUP_RESEARCH.md) · [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) · [Existing TODO](./TODO.md)

---

## Current State Summary

**What we have working today:**

- Auth (email, OAuth, magic link) + onboarding
- Content ingestion: PDF + YouTube → chunk → embed → summarize → extract concepts → generate quizzes
- AI Mentor: RAG-powered Socratic chat with tool calling, streaming, citations
- Quiz + Review: FSRS-5 scheduling, daily queue, MCQ/short-answer, 1–4 rating
- Knowledge Graph: force-directed visualization, mastery colors, click-to-detail, filters
- Learning Goals: AI curriculum generation, teach → check → explain-back session flow
- Stats: streak, mastery distribution, recent reviews
- Library: grid/list, upload dialog, content detail with tabs (summary, full text, concepts, quizzes)

**What's still pending from Phase 1 (finish later, not for now):**

- [ ] Redis-cached daily queue + midnight cron pre-computation
- [ ] Unit tests for RAG retrieval, daily queue generation
- [ ] Integration tests (full ingestion pipeline, review session)
- [ ] E2E flow test
- [ ] Mobile responsiveness audit
- [ ] Observability: Sentry, Langfuse, PostHog, Vercel Analytics
- [ ] Vercel deployment + CI/CD

---

## Priority Legend

| Tag      | Meaning                                                                         |
| -------- | ------------------------------------------------------------------------------- |
| **P0**   | Ship before beta launch — directly addresses top user complaint or critical gap |
| **P1**   | Ship during beta — strong differentiator, high user demand                      |
| **P2**   | Ship post-beta — nice-to-have, builds moat over time                            |
| **WTP**  | Users have expressed willingness to pay for this                                |
| **MOAT** | Contributes to defensible competitive moat                                      |

---

## Tier 1 — Close the Gaps Users Are Screaming About

> These features directly address the top complaints from YouLearn, NotebookLM, and Anki users. Ship before or during beta.

### 1.1 Additional Content Formats (P0 · WTP) ✅ SHIPPED

**Market signal:** YouLearn's #1 format complaint. Students need to throw slides and docs at the tool — conversion to PDF is a dealbreaker.

- [x] **PPT/PPTX ingestion** — `officeparser`, extract text + slide structure + speaker notes
- [x] **DOCX/Word ingestion** — `officeparser`, preserve heading hierarchy for better chunking
- [x] **Audio file ingestion** (MP3, WAV, M4A) — Whisper API transcription → standard chunking pipeline
- [x] **Web URL ingestion** — `@mozilla/readability` + `linkedom` for clean article extraction, SSRF-safe
- [x] **Image ingestion** (PNG, JPG, WebP) — GPT-4o vision for OCR + content description → text pipeline
- [x] Wire all new formats into existing `runIngestionPipeline` with format-specific extractors
- [x] Update `UploadDialog` to accept new file types + show format icons (3-tab: File/YouTube/Web URL)
- [x] Supabase Storage bucket MIME type whitelist already configured

**Deps:** Existing ingestion pipeline (done)  
**Shipped:** March 8, 2026

### 1.2 Cross-Source Knowledge Connections (P0 · MOAT) ✅ SHIPPED

**Market signal:** NotebookLM's #1 complaint — every notebook is a silo. Users upload 10 documents and can't see how concepts connect across them. This is LearnGraph's core thesis.

- [x] **Cross-document concept linking** — existing cosine similarity ≥ 0.92 dedup pipeline already matches across all user concepts globally
- [x] **"Related content" panel** — new "Related" tab on `/library/[id]` shows other learning objects sharing concepts, sorted by overlap count
- [x] **Graph view: cross-source mode** — toggle highlights cross-source concepts with golden ring, dims single-source nodes, shows source count in detail panel
- [x] **"Connection discovery" notifications** — after ingestion, toast: "N connections found with your other materials" with link to Related tab
- [x] **Cross-source RAG** — mentor chat already pulls chunks from ANY user document (confirmed via `userId` scoping in `retrieveChunks`)

**Deps:** Concept extraction (done), graph visualization (done)  
**Shipped:** March 8, 2026

### 1.3 Export & Portability (P0 · WTP) ✅ SHIPPED

**Market signal:** NotebookLM users screenshotting chat threads. Zero export = zero trust. This is a trust feature, not a power feature.

- [x] **Export summaries** — download as Markdown or JSON (per learning object or all)
- [x] **Export flashcards** — Anki-compatible TSV export + Markdown + JSON (for users migrating from Anki)
- [x] **Export knowledge graph** — JSON, CSV, or Markdown of concepts + edges + mastery states
- [x] **Export conversation history** — Markdown with citations preserved + JSON
- [x] **Bulk data export** — "Download all my data" in `/export` page (GDPR-ready JSON)
- [x] API endpoint: `GET /api/export?type=...&format=...` with Supabase auth
- [x] Export page at `/export` with stats overview and per-type download buttons

**Deps:** All data already in Postgres  
**Shipped:** March 8, 2026

### 1.4 Mobile-First Review Experience (P0 · WTP)

**Market signal:** YouLearn mobile is an afterthought. Anki mobile UX is brutal. Students want 5-minute review sessions on their phone between classes.

- [ ] **PWA manifest + service worker** — installable on homescreen, splash screen, offline shell
- [ ] **Offline review queue** — cache today's cards + questions in IndexedDB, sync ratings when back online
- [ ] **Touch-optimized review UI** — swipe gestures for ratings (left=Again, right=Good), larger tap targets
- [ ] **Push notifications** — daily review reminder at user's preferred time (Web Push API)
- [ ] **Responsive audit** — every page tested at 375px / 390px / 428px (iPhone SE / 14 / 14 Pro Max)
- [ ] Reduce JS bundle size for fast mobile load (analyze with `@next/bundle-analyzer`)

**Deps:** Review session (done), user preferences (done)  
**Effort:** 2 weeks

---

## Tier 2 — Differentiation That Competitors Can't Easily Copy

> These features build LearnGraph's moat and justify paying for Pro. They require the learning graph infrastructure we already have.

### 2.1 Knowledge Gap Detection (P1 · MOAT · WTP)

**Market signal:** No tool tells you _what you don't know_. Users figure this out the hard way on exam day. This is the "GPS for knowledge" feature from our research.

- [ ] **Gap detection algorithm** — compare user's `user_concept_state` against a target:
  - All concepts from a specific learning object (study completeness)
  - All prerequisites of a target concept (readiness check)
  - Custom concept set (exam syllabus, job role requirements)
- [ ] **Topological sort** — present gaps in prerequisite order (learn A before B)
- [ ] **Priority scoring** — weight by: downstream dependency count × mastery deficit × FSRS retrievability decay
- [ ] **Gap detection UI** — `/goals/[id]/gaps` page showing gap waterfall + "Fix this gap" CTA that creates targeted review session
- [ ] **Proactive gap alerts** — during mentor chat, if user asks about concept X but hasn't mastered prerequisite Y, mentor says: "Before we dive into X, let's make sure you're solid on Y"

**Deps:** Concept edges (done), user_concept_state (done), FSRS (done)  
**Effort:** 1–2 weeks  
**Integration:** Wire into mentor system prompt + review queue prioritization

### 2.2 Explain-Back Mode (P1 · MOAT)

**Market signal:** UPenn study showed AI tutoring doesn't improve exam scores — students get answers without building understanding. Explain-back triggers the protégé effect (strongest encoding).

- [ ] **Explain-back question type** — user records/types an explanation of a concept as if teaching a beginner
- [ ] **AI evaluation** — LLM scores explanation on: accuracy, completeness, clarity, misconceptions detected
- [ ] **Corrective feedback** — "You nailed X, but you missed Y and here's a common misconception about Z"
- [ ] **Mastery boost** — successful explain-back gives the highest FSRS rating boost (already in `computeMasteryExplainBack`)
- [ ] **Explain-back in review queue** — for concepts at mastery level 3+, occasionally replace MCQ with explain-back prompt
- [ ] **Voice explain-back** (stretch) — user speaks their explanation, Whisper transcribes, LLM evaluates

**Deps:** Quiz generation (done), FSRS (done), mastery tracking (done). Session orchestrator already has `evaluateExplainBack`.  
**Effort:** 1 week (backend mostly done, need UI)

### 2.3 Persistent Learning Context (P1 · MOAT)

**Market signal:** Reddit's #1 AI workflow complaint — context loss between sessions. Users re-explain everything every time. LearnGraph already has the data to solve this.

- [ ] **Session-aware mentor** — on new conversation, mentor system prompt includes:
  - User's overall mastery snapshot (top strengths, weakest concepts)
  - Recently reviewed concepts + ratings from last 7 days
  - Active learning goals + curriculum progress
  - Previous conversation summaries (auto-generated)
- [ ] **"Continue where I left off"** — home page shows last active learning session with resume button
- [ ] **Learning journal** — auto-generated weekly summary: "This week you mastered 5 concepts, struggled with 2, reviewed 47 cards"
- [ ] **Mentor memory** — store key facts the mentor learns about the user (learning style preferences, analogies that worked) in `users.preferences` JSONB

**Deps:** Mentor chat (done), user_concept_state (done), review_log (done)  
**Effort:** 1 week

### 2.4 Smart Daily Queue Enhancements (P1 · WTP)

**Market signal:** Anki users complain about burnout from too many reviews. The queue needs to be smart, not just a dump of due cards.

- [ ] **Interleaving** — mix concepts from different subjects within a session (research shows 43% better transfer)
- [ ] **Difficulty ramping** — start session with easy cards (warm-up), peak difficulty mid-session, cool down at end
- [ ] **Session length adaptation** — if user consistently bails at card 12, suggest a 10-card session instead of 20
- [ ] **"Quick 5" mode** — 5-card micro-session for between-class moments (optimized for mobile)
- [ ] **Concept clustering** — group related concepts together in review so users see connections
- [ ] **Redis caching** — pre-compute queue at midnight user-local-time, serve from cache (< 50ms)

**Deps:** Daily queue (done), FSRS (done), user preferences (done)  
**Effort:** 1–2 weeks

### 2.5 AI Curriculum Builder Improvements (P1 · WTP)

**Market signal:** Users want "I want to learn X" → the tool builds the complete path. We have basic curriculum generation — now make it production-quality.

- [ ] **Web resource sourcing** — when user sets a goal without uploading content, AI suggests YouTube videos + free resources to upload
- [ ] **Adaptive pacing** — if user masters curriculum items faster/slower than expected, AI adjusts the schedule
- [ ] **Prerequisite checking** — before starting a curriculum item, verify user has mastered prerequisites (link to gap detection)
- [ ] **Progress milestones** — visual progress bar per goal, celebration animations on milestone completion
- [ ] **Curriculum sharing** — generate a shareable link to a curriculum (read-only, no user data)

**Deps:** Learning goals (done), curriculum items (done), gap detection (2.1)  
**Effort:** 2 weeks

---

## Tier 3 — Growth & Engagement Features

> These features drive retention, virality, and monetization. Build after core differentiation is solid.

### 3.1 Study Streaks & Gamification (P1)

**Market signal:** Duolingo proved streaks drive retention. Users mentioned wanting streak mechanics in study tools.

- [ ] **Streak tracking** — consecutive days with ≥ 1 completed review (timezone-aware, use `users.timezone`)
- [ ] **Streak shields** — 1 free "freeze" per week (miss a day without breaking streak)
- [ ] **Weekly goals** — "Review 50 cards this week" with progress ring
- [ ] **Achievement badges** — "First upload", "7-day streak", "100 concepts mastered", "Explain-back pro"
- [ ] **Level-up animations** — when a concept moves to mastery level 5, trigger `animate-level-up`
- [ ] **XP system** — points for reviews, uploads, explain-backs. Leaderboard (opt-in).

**Deps:** Review log (done), streak counter (partial — static in dashboard)  
**Effort:** 1–2 weeks  
**Schema:** May need `user_achievements` table

### 3.2 Study Reminders & Nudges (P1)

**Market signal:** "Users don't return for daily reviews" is the #1 retention risk from our technical architecture risk table.

- [ ] **Email reminders** — daily digest via Resend: "You have 12 concepts to review today. Estimated time: 6 min"
- [ ] **Push notifications** — Web Push at user's preferred study time
- [ ] **Smart nudges** — if user hasn't studied in 3 days, escalate: "Your memory of [concept] is fading — review now to save it"
- [ ] **Notification preferences** — granular: email on/off, push on/off, frequency, quiet hours
- [ ] Store notification preferences in `users.preferences` JSONB

**Deps:** Push notification setup (PWA from 1.4), user preferences (done)  
**Effort:** 1 week

### 3.3 Enhanced Graph Visualization (P2 · MOAT)

**Market signal:** Users want mind maps and visual connections. Current graph is functional but could be stunning.

- [ ] **Cluster detection** — auto-group concepts by domain/subject, draw cluster boundaries
- [ ] **Graph search** — type a concept name → zoom to that node
- [ ] **Minimap** — for graphs with 100+ nodes, show overview minimap in corner
- [ ] **Time-travel view** — slider to see how your knowledge graph evolved over weeks/months
- [ ] **Heatmap mode** — color nodes by retrievability (green=fresh, red=decaying) instead of mastery level
- [ ] **Share graph** — generate a beautiful static image of your knowledge graph for social sharing

**Deps:** Knowledge graph (done)  
**Effort:** 2 weeks

### 3.4 Learning Analytics Dashboard (P2 · WTP)

**Market signal:** Users want retention curves, study efficiency metrics, predicted exam readiness.

- [ ] **Retention curve** — plot actual vs. predicted recall probability over time per concept
- [ ] **Study efficiency** — time spent studying vs. mastery gained (are you studying the right things?)
- [ ] **Predicted exam readiness** — given a set of target concepts, what % are you likely to recall on exam day?
- [ ] **Comparative stats** — "You've reviewed 30% more than last week" trend indicators
- [ ] **Best study times** — analyze review_log timestamps to suggest when user performs best
- [ ] Use Recharts (already installed) for all visualizations

**Deps:** Review log (done), user_concept_state (done), stats page (done — extend it)  
**Effort:** 1–2 weeks

---

## Tier 4 — Monetization & Scale

> Build these when approaching 1,000+ MAU and ready for revenue.

### 4.1 Pro Tier + Stripe Integration (P1 · WTP)

**Market signal:** YouLearn charges $12-20/mo. Users accept this but hate the restrictive free tier. Our free tier must be generous.

- [ ] **Stripe integration** — Checkout, Customer Portal, webhooks for subscription lifecycle
- [ ] **Free tier limits:**
  - 5 uploads/day (YouLearn: 3)
  - 20 AI mentor messages/day (YouLearn: 5)
  - 20 review cards/day (unlimited for Anki refugees — this is the hook)
  - 2 learning goals
  - Basic graph view
- [ ] **Pro tier ($12/mo or $99/yr):**
  - Unlimited uploads, mentor messages, reviews
  - Unlimited goals + curriculum builder
  - Advanced analytics + retention curves
  - Export (Anki, Markdown, PDF)
  - Priority ingestion processing
  - Voice explain-back
- [ ] **Usage tracking middleware** — count per-user daily usage against limits
- [ ] **Upgrade prompts** — contextual, non-annoying: "You've used 4/5 uploads today. Upgrade for unlimited."
- [ ] Store `subscription` status in `users.subscription` (already in schema)

**Deps:** Core features stable  
**Effort:** 2 weeks

### 4.2 Landing Page & Marketing Site (P1)

- [ ] **Landing page** — hero section, feature showcase, social proof, pricing, CTA
- [ ] **Comparison page** — "LearnGraph vs YouLearn vs NotebookLM vs Anki" feature matrix
- [ ] **Blog** — SEO content targeting "AI study tools", "spaced repetition app", "AI flashcards"
- [ ] **Waitlist → conversion funnel** — email capture, onboarding sequence

**Effort:** 1–2 weeks

### 4.3 Collaborative Features (P2 · MOAT)

**Market signal:** Every AI learning tool is single-player. Network effects = defensible moat.

- [ ] **Shared knowledge graphs** — create a study group, pool concept mastery across members
- [ ] **Study group chat** — group mentor session where AI mediates discussion
- [ ] **Peer quiz challenges** — quiz battle mode, timed, ranked
- [ ] **Community concept definitions** — users can upvote/edit AI-generated concept definitions
- [ ] New tables: `study_groups`, `group_members`, `group_activity`

**Deps:** Core graph + review features stable  
**Effort:** 4–6 weeks

---

## Tier 5 — Long-Term Platform Plays

> These transform LearnGraph from a tool into a platform. Phase 3+.

### 5.1 Learn From Work Artifacts (P2)

- [ ] **Connect GitHub repos** — AI teaches architecture patterns from your actual codebase
- [ ] **Connect Notion/Google Docs** — import workspace docs as learning objects
- [ ] **Slack/Teams integration** — "Ask LearnGraph" bot that answers from team knowledge
- [ ] OAuth + API integrations for each platform

### 5.2 API & Integrations (P2)

- [ ] **Anki import** — `.apkg` parser to import existing Anki decks as concepts + cards
- [ ] **Calendar sync** — block study time in Google Calendar / Outlook
- [ ] **LMS integration** — Canvas / Moodle grade sync, assignment import
- [ ] **Public API** — REST endpoints for third-party integrations
- [ ] **Zapier/Make webhooks** — "When new content uploaded" → trigger external actions

### 5.3 React Native Mobile App (P2)

- [ ] **iOS + Android** via React Native + Expo
- [ ] **Offline-first** — SQLite (expo-sqlite) for local review state, background sync
- [ ] **Apple Watch companion** — daily review reminder + quick stats
- [ ] **Siri shortcuts** — "Hey Siri, start my review"
- [ ] Share business logic via existing TypeScript packages in monorepo

### 5.4 Enterprise / Team Edition (P2)

- [ ] **Team workspaces** — shared content library, admin controls
- [ ] **SSO** (SAML/OIDC) for enterprise auth
- [ ] **Admin dashboard** — team progress, content usage, license management
- [ ] **Onboarding paths** — structured learning tracks for new hires with checkpoints
- [ ] **Staleness detection** — flag docs that haven't been updated but reference changed systems

---

## Implementation Priority Matrix

```
                        HIGH USER DEMAND
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          │  1.2 Cross-Source  │  1.1 Formats      │
          │  1.3 Export        │  1.4 Mobile PWA   │
          │  2.3 Persistence   │  2.1 Gap Detection│
          │                   │  2.2 Explain-Back  │
  LOW ────┼───────────────────┼───────────────────┤──── HIGH
  EFFORT  │                   │                   │  EFFORT
          │  3.1 Gamification │  3.4 Analytics     │
          │  3.2 Reminders    │  4.1 Stripe        │
          │                   │  4.2 Landing Page  │
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                        LOW USER DEMAND
```

## Recommended Build Order

| Sprint              | Features                                     | Rationale                                                |
| ------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **Sprint 1** (1 wk) | 1.2 Cross-Source + 1.3 Export                | Low effort, addresses #1 complaints, core differentiator |
| **Sprint 2** (2 wk) | 1.1 Additional Formats + 2.2 Explain-Back UI | Format breadth + explain-back backend is already done    |
| **Sprint 3** (2 wk) | 1.4 Mobile PWA + 3.2 Reminders               | Retention loop: mobile review + push nudges              |
| **Sprint 4** (2 wk) | 2.1 Gap Detection + 2.3 Persistent Context   | The "GPS for knowledge" — our core moat feature          |
| **Sprint 5** (2 wk) | 2.4 Queue Enhancements + 3.1 Gamification    | Retention mechanics: smart queue + streaks               |
| **Sprint 6** (2 wk) | 4.1 Stripe + 4.2 Landing Page                | Monetization + acquisition funnel                        |
| **Sprint 7** (2 wk) | 2.5 Curriculum Improvements + 3.4 Analytics  | Polish the goal-driven flow                              |
| **Sprint 8** (2 wk) | 3.3 Graph Enhancements + 5.2 Anki Import     | Visual wow factor + Anki user migration path             |

**Total: ~15 weeks to feature-complete beta with monetization.**

---

## Key Metrics to Track

| Metric                              | Target                | Why                                      |
| ----------------------------------- | --------------------- | ---------------------------------------- |
| D7 retention                        | > 40%                 | Core engagement — are users coming back? |
| Daily review completion rate        | > 60%                 | Is the SRS loop working?                 |
| Concepts mastered per user per week | > 10                  | Learning velocity                        |
| Cross-source connections per user   | > 5                   | Graph moat building                      |
| Free → Pro conversion               | > 5%                  | Revenue viability                        |
| NPS                                 | > 40                  | Product-market fit signal                |
| LLM cost per user per month         | < $1.00               | Unit economics                           |
| Time-to-first-review                | < 10 min after signup | Onboarding friction                      |

---

_This document should be updated as features ship and new market signals emerge. Cross-reference with [TODO.md](./TODO.md) for Phase 1 remaining items._
