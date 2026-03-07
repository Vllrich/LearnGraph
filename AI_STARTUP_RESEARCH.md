# AI Startup Research: YouLearn.ai Landscape & Top 5 Product Opportunities

> **Date:** March 7, 2026
> **Research Team Roles:** Problem Researcher · Market Analyst · User Researcher · Product Strategist

---

## Executive Summary

YouLearn.ai (YC-backed, ~$77K MRR, 150K+ MAU) proves there's real demand for AI-powered learning from unstructured content. But the space has glaring gaps: unreliable accuracy for high-stakes use, no retention science, weak mobile, no team/B2B play, and a creator monetization vacuum. Below we dissect the landscape and surface 5 validated product opportunities.

---

## YouLearn.ai: Teardown

### What It Does
- Ingests PDFs, YouTube videos, slides, recorded lectures
- Generates summaries, flashcards, quizzes, chat-based Q&A
- Voice mode for hands-free learning
- Progress tracking dashboard

### Pricing
| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 3 uploads/day, 5 AI chats, 10 quiz answers, 100-page max |
| Pro | ~$12-20/mo | Unlimited uploads, chats, messages |

### Strengths
- Strong video + PDF workflow
- Voice mode is a genuine differentiator
- Clean UX for the core flow (upload → study)
- YC backing provides credibility and distribution

### Weaknesses (Validated by User Reviews)
- **Restrictive free tier** — unusable for real study sessions
- **No PowerPoint, Word, or image support** — massive friction for students/professionals
- **Mobile experience is secondary** — inconsistent performance across regions
- **Answer accuracy varies wildly** — unreliable for rigorous academic or professional use
- **No spaced repetition** — generates flashcards but doesn't optimize when you review them
- **No collaboration** — purely single-player; no team/cohort features
- **No citation depth** — unsuitable for research-grade work
- **TrustPilot: 3.2/5** with minimal reviews — weak social proof

---

## STEP 1 — Problems Identified

### Problem 1: AI Study Tools Don't Produce Real Retention
**Who:** Students (K-12, university, professional certification)
**Current Workaround:** Manually creating Anki decks; using separate spaced repetition tools alongside AI summarizers
**Evidence:**
- *"AI tools give you the answer but don't teach you how to think"* — Reddit r/Step2
- *"Quick forgetting after exams rather than true comprehension"* — Reddit AI study tool threads
- 65% of knowledge workers use AI document tools (Gartner 2024), yet retention outcomes aren't measured
- NotebookLM, YouLearn, StudyFetch all generate flashcards but **none integrate spaced repetition algorithms** (FSRS, SM-2)

### Problem 2: Professional Certification Prep is Overpriced and Generic
**Who:** CFA, CPA, AWS, USMLE, Bar Exam candidates
**Current Workaround:** $300-$500+ for Kaplan/Schweser + ChatGPT on the side for explanations
**Evidence:**
- PrepNexus disrupts CFA prep at $50/mo vs Kaplan's $299 — proves price sensitivity
- ChatGPT scored 520 on MCAT but "struggles with nuanced reasoning" and "misses basic content questions" in CARS section
- Reddit r/Step2 user scored 261 using GPT-5.1 but required *highly structured, manual prompt engineering* daily — the tooling doesn't exist to automate this
- *"AI can't even solve simple integrals without making dumb mistakes"* — Reddit calculus students

### Problem 3: Content Creators Can't Monetize Knowledge Without Becoming Course Builders
**Who:** YouTubers, podcast hosts, newsletter writers, subject-matter experts
**Current Workaround:** Manually scripting courses on Teachable/Kajabi; hiring course designers; or ignoring the revenue stream entirely
**Evidence:**
- Coursyllab (10K+ courses created), CourseForge ($49-499/mo), Teachly, AcademyLauncher (30K+ creators, $10M revenue) all exist — but they're course *creation* tools, not audience *learning* platforms
- Gap: No tool lets a creator's audience learn interactively from their existing content library with AI tutoring, quizzes, and retention tracking
- Creator economy is $250B+ (2025) and knowledge monetization is the fastest-growing segment

### Problem 4: Enterprise Onboarding Knowledge Rots in Wikis Nobody Reads
**Who:** Engineering managers, L&D teams, new hires at tech companies (50-5000 employees)
**Current Workaround:** Confluence wikis, Notion docs, Loom videos, Slack tribal knowledge
**Evidence:**
- New hire ramp: 3-6 months typical; AI onboarding tools claim 30% reduction
- *"80% of enterprises see no material earnings impact despite $644B in AI spending"* — enterprise training research
- 89% of companies identify AI skills gaps; only 6% have upskilling programs
- Existing tools (Disco, Denser, Chimpanion) solve *delivery* but not *content decay* — docs go stale, nobody knows what's outdated
- Managers spend 10-15 hours per hire on onboarding support

### Problem 5: Students Juggle 5+ Tools and Still Can't Study Effectively
**Who:** University students managing lectures, readings, problem sets, group study
**Current Workaround:** NotebookLM for summaries + Anki for flashcards + ChatGPT for Q&A + Google Docs for notes + Calendar for scheduling = fragmented chaos
**Evidence:**
- Reddit top AI study tools threads show students recommending 4-6 different tools for different purposes
- No single tool handles: content ingestion → active recall → spaced repetition → progress analytics → exam simulation
- StudyFetch, YouLearn, Quizlet AI each solve 1-2 pieces but force tool-switching
- *"Subscription costs add up — ChatGPT's $20/month Plus is burdensome"* — Reddit students on budget pressure

---

## STEP 2 — Market Context

### AI Tutoring Market
| Metric | Value |
|--------|-------|
| 2024 Market Size | $1.63B |
| 2026 Projected | $2.55B |
| 2030 Projected | $7.99B |
| CAGR (2025-2030) | 30.5% |

### Broader AI in Education
| Metric | Value |
|--------|-------|
| 2025 Market Size | $6.4B |
| 2030 Projected | $32.27B |
| 2034 Projected | $79.6B |
| CAGR (2026-2034) | 31.35% |

### Key Market Dynamics
- **K-12 dominates** (58.8% of AI tutors market) — but professional/adult learning is underpenetrated
- **North America** is 35-38% of global market — highest willingness to pay
- **Trend shift:** Passive note-taking → Active assessment → Retention science
- **Gartner:** 65% of knowledge workers use AI document tools (up from 22% in 2022)

### Competitive Landscape

| Player | Focus | Weakness |
|--------|-------|----------|
| YouLearn.ai | Content → study aids | No retention, no collaboration, limited formats |
| NotebookLM | Research synthesis | No assessments, no spaced repetition, no exam prep |
| Quizlet AI | Flashcards | Shallow AI, no content ingestion |
| StudyFetch | Lecture → study | Accuracy complaints, limited features |
| Anki | Spaced repetition | Manual card creation, no AI, brutal UX |
| Kaplan/Schweser | Cert prep | $300+ pricing, not personalized, no AI tutoring |
| Coursyllab | Video → course | Creator tool, not learner tool |
| Disco | Cohort learning | Enterprise only, no individual AI tutoring |

---

## STEP 3 — User Demand Signals

### Scoring Criteria (1-5 scale)

| Idea | Pain Intensity | Frequency | Willingness to Pay | Urgency | **Total** |
|------|---------------|-----------|--------------------|---------|---------| 
| 1. Retention-first AI study platform | 5 | 5 | 4 | 4 | **18** |
| 2. AI cert prep disruptor | 5 | 3 | 5 | 5 | **18** |
| 3. Creator → audience learning platform | 4 | 4 | 4 | 3 | **15** |
| 4. Living knowledge base for teams | 4 | 5 | 4 | 3 | **16** |
| 5. Unified AI study OS | 4 | 5 | 3 | 4 | **16** |

### Signal Sources

**Retention-first platform:**
- Scholium, Mindura, Memlex, Rember all launched 2025-2026 targeting this — but none combine content ingestion + spaced repetition in one product
- Anki has millions of users suffering through terrible UX because spaced repetition *works*
- "500% retention boost" claims from Scholium (using FSRS algorithm)

**AI cert prep:**
- PrepNexus already proves $50/mo CFA prep sells vs $300 Kaplan
- Reddit MCAT/USMLE communities actively discussing AI study strategies
- One Redditor manually engineered daily GPT prompts for Step 2 CK — scored 261 — the tooling gap is screaming

**Creator learning platform:**
- AcademyLauncher: 30K+ creators, $10M in creator revenue
- Coursyllab: 10K+ courses generated
- But these are *creation* tools — nobody has built the *consumption* experience with AI tutoring

**Living knowledge base:**
- Denser claims 30% reduction in ramp time; 10-15 hours saved per hire
- 89% of companies identify skills gaps; 6% have programs
- $644B in AI spending with 80% seeing no impact — the infrastructure is broken

**Unified study OS:**
- Every Reddit thread on study tools recommends a *stack* of 4-6 apps
- No single product owns the full loop: ingest → understand → practice → retain → assess

---

## STEP 4 — Product Concepts (Top 5)

---

### IDEA 1: RecallAI — The Retention-First AI Study Platform

**Core Value Proposition:** Upload anything. Understand it once. Remember it forever. The only AI study tool that uses cognitive science (spaced repetition + active recall) to guarantee you retain what you learn.

**Ideal User:** University students (STEM, pre-med, law) and lifelong learners who study 10+ hours/week and are tired of re-learning material they've already covered.

**MVP Feature Set:**
1. Content ingestion (PDF, YouTube, slides, audio)
2. AI-generated flashcards with FSRS spaced repetition scheduling
3. Active recall quizzes (not just recognition — free-response, explain-back)
4. Daily review queue optimized by forgetting curve
5. Retention analytics dashboard (what you know vs. what's decaying)

**Unique Differentiation:**
- Every competitor stops at *comprehension* (summarize → quiz). RecallAI owns *retention* — the thing students actually care about on exam day.
- FSRS algorithm (open-source, research-backed) beats SM-2 (Anki's algorithm from 1987).
- "Explain back" mode: forces the student to teach the concept to the AI, triggering the strongest form of encoding (the protégé effect).

---

### IDEA 2: CertCrush — AI-Powered Professional Certification Prep

**Core Value Proposition:** Pass your certification exam in half the time, at a quarter of the price. AI that adapts to your weak spots and drills them until they're strengths.

**Ideal User:** Working professionals studying for CFA, CPA, AWS, PMP, or medical board exams (25-40 years old, time-poor, budget-conscious).

**MVP Feature Set:**
1. Exam-specific question banks with AI-generated explanations
2. Adaptive learning engine that identifies and targets weak areas
3. AI tutor chat grounded in official study material (no hallucinations)
4. Daily study plans auto-generated based on exam date and available hours
5. Practice exams that simulate real test conditions (timing, format, difficulty)

**Unique Differentiation:**
- Price: $29-49/mo vs. $300-500 for Kaplan/Schweser/Becker
- "Error log" feature inspired by the Reddit Step 2 CK scorer: AI tracks every mistake, categorizes the knowledge gap, and generates targeted drill sets
- Accuracy guarantee: answers cite specific sections of official source material with page numbers
- Pass-or-refund guarantee (funded by high margins on SaaS pricing)

---

### IDEA 3: LearnLayer — Turn Your Content Into an AI-Powered Learning Experience for Your Audience

**Core Value Proposition:** You create the content. LearnLayer turns your audience into students — with AI tutoring, quizzes, and certificates built on top of your existing YouTube/podcast/newsletter library.

**Ideal User:** Educational content creators with 10K-500K followers who want to monetize beyond ads and sponsorships without building a course from scratch.

**MVP Feature Set:**
1. Connect YouTube channel / podcast RSS / blog URL
2. AI auto-generates structured curriculum from existing content
3. Audience members get an AI tutor trained on the creator's content
4. Auto-generated quizzes, flashcards, and completion certificates
5. Creator dashboard: audience engagement, revenue, completion rates

**Unique Differentiation:**
- Not a course *creation* tool (Teachable, Kajabi) — it's a course *experience* layer on top of content that already exists
- Zero creator effort: the AI does all the structuring and curriculum design
- Revenue model: creator sets price, LearnLayer takes 10-15% platform fee
- Built-in AI tutor that *sounds like the creator* (trained on their voice/style)

---

### IDEA 4: Basecamp (Knowledge) — The Living Knowledge Base That Doesn't Rot

**Core Value Proposition:** Your team's knowledge, always current, always accessible. AI that detects when docs are stale, auto-suggests updates, and onboards new hires without requiring a single "shadow session."

**Ideal User:** Engineering managers and L&D leads at tech companies (50-2000 employees) spending 10+ hours per new hire on onboarding and fighting outdated documentation.

**MVP Feature Set:**
1. Import from Notion, Confluence, Google Docs, Slack, Loom
2. AI-powered search + Q&A over the entire knowledge base (cited answers)
3. Staleness detection: flags docs that haven't been updated but reference changed systems
4. New hire onboarding paths: structured learning tracks with quizzes and checkpoints
5. "Ask the base" Slack bot: instant answers from organizational knowledge

**Unique Differentiation:**
- Every wiki tool stores knowledge. This one *maintains* it — staleness detection is the killer feature nobody has built well
- Onboarding ROI is immediately measurable: time-to-productivity, support tickets reduced, manager hours saved
- Not another wiki — it's an intelligence layer that sits on top of tools teams already use
- Competitive moat: the more a team uses it, the smarter it gets about their specific domain

---

### IDEA 5: StudyOS — The Unified AI Study Workspace

**Core Value Proposition:** Stop juggling NotebookLM + Anki + ChatGPT + Google Docs. One workspace where you ingest, understand, practice, retain, and ace your exams.

**Ideal User:** University students (especially pre-med, law, engineering) managing heavy courseloads across multiple subjects and formats.

**MVP Feature Set:**
1. Universal content ingestion (PDF, video, audio, slides, web pages, **PowerPoint, Word, images**)
2. AI summaries + concept maps + key term extraction
3. Integrated spaced repetition flashcard system
4. Practice question generator (MCQ, short answer, essay prompts)
5. Study planner with Pomodoro timer and weekly review scheduling
6. Cross-subject knowledge graph showing concept connections

**Unique Differentiation:**
- **Format breadth** — supports PowerPoint, Word, and images (YouLearn's biggest gap)
- **Full learning loop** in one tool — no more app-switching tax
- **Knowledge graph** — see how concepts from different courses connect (e.g., biochemistry ↔ pharmacology)
- Free tier that's actually usable (10 uploads/day, unlimited flashcard reviews) — attack YouLearn's biggest complaint
- Mobile-first design (address YouLearn's second-biggest complaint)

---

## STEP 5 — Validation Strategy

### Idea 1: RecallAI

| Test | Method | Success Metric |
|------|--------|---------------|
| Landing page | Ship to r/AnkiDroid, r/medicalschool, r/GetStudying | 500 email signups in 2 weeks |
| Fake door | "Import from Anki" button on landing page → waitlist | 20%+ click-through rate |
| Community validation | Post "I built an AI that schedules your flashcard reviews" in r/Anki | 50+ upvotes, 20+ comments asking for access |
| Waitlist survey | Ask signups: "How many hours/week do you spend on flashcard review?" | Average >3 hours confirms pain |

### Idea 2: CertCrush

| Test | Method | Success Metric |
|------|--------|---------------|
| Landing page | Target r/CFA, r/CPA, r/AWSCertifications | 300 signups in 2 weeks |
| Pre-sale | Offer "Founding Member" pricing at $29/mo for lifetime | 50 paying customers before building |
| Community validation | Post comparison calculator: "CertCrush vs Kaplan: save $250+" | High engagement + shares |
| Fake door | "Start Free Practice Exam" button → capture email | 30%+ conversion |

### Idea 3: LearnLayer

| Test | Method | Success Metric |
|------|--------|---------------|
| Cold outreach | DM 50 educational YouTubers (10K-100K subs) with mockup | 5+ interested in beta |
| Landing page | "Monetize your YouTube channel with AI courses" | 200 creator signups in 3 weeks |
| Fake door | "Connect Your YouTube Channel" → waitlist | 25%+ click-through |
| Community validation | Post in creator communities (r/NewTubers, r/YouTubers) | Qualitative signal: "I've been wanting this" |

### Idea 4: Basecamp Knowledge

| Test | Method | Success Metric |
|------|--------|---------------|
| Landing page | Target engineering manager communities, HackerNews | 200 company signups in 3 weeks |
| Pilot | Offer free 30-day pilot to 5 companies (50-200 employees) | 3/5 convert to paid |
| ROI calculator | "How much does bad onboarding cost you?" interactive tool | 500+ calculator completions |
| Community validation | Post "Show HN: We built a knowledge base that tells you when docs are stale" | Front page engagement |

### Idea 5: StudyOS

| Test | Method | Success Metric |
|------|--------|---------------|
| Landing page | "The last study app you'll ever need" → r/GetStudying, r/college | 1000 signups in 3 weeks |
| Fake door | Feature checklist: "Which features matter most?" (rank-order survey) | Data on which features drive signup intent |
| Competitive teardown | Video: "I replaced 5 study apps with one — here's what happened" on YouTube/TikTok | 50K+ views, high comment engagement |
| Beta cohort | Invite 100 students, measure tool-switching reduction | 60%+ report dropping at least 2 other tools |

---

## STEP 6 — Final Rankings & Recommendations

### Top 5 Ideas Summary

| Rank | Idea | Problem | Market Size | Differentiation | MVP Effort | Confidence |
|------|------|---------|-------------|-----------------|------------|------------|
| **1** | **CertCrush** | Cert prep is $300+, generic, not AI-native | $2.5B+ (test prep) | 5-10x cheaper, adaptive, error-log-driven | Medium (3-4 months) | **High** — proven WTP, clear ICP, measurable ROI |
| **2** | **RecallAI** | AI tools teach but don't ensure retention | $7.99B by 2030 (AI tutors) | FSRS + content ingestion in one product | Medium (3-4 months) | **High** — Anki's UX gap is a gift |
| **3** | **Basecamp Knowledge** | Enterprise docs rot, onboarding is broken | $644B AI spend, 89% skills gap | Staleness detection, not just another wiki | Medium-High (4-5 months) | **Medium-High** — longer sales cycle but high LTV |
| **4** | **StudyOS** | Students use 5+ fragmented tools | $2.55B (AI tutors, 2026) | Full learning loop, format breadth, mobile-first | High (5-6 months) | **Medium** — broad scope risk, but massive TAM |
| **5** | **LearnLayer** | Creators can't monetize without building courses | $250B+ creator economy | Zero-effort course experience layer | Medium (3-4 months) | **Medium** — creator adoption is hard, but if it clicks the flywheel is powerful |

### Strategic Insight

YouLearn.ai validated the market. Their weaknesses — no retention science, no professional exam depth, no creator monetization, no team features, and a restrictive free tier — aren't bugs to fix. They're **separate products to build.**

The highest-conviction play is **CertCrush** (Idea 2): the willingness to pay is already proven ($300+ Kaplan spend), the user is time-constrained and outcome-driven (pass/fail is binary), and a 5-10x price disruption with AI personalization is a wedge that traditional players can't easily match.

The highest-upside play is **RecallAI** (Idea 1): spaced repetition is scientifically proven to be the most effective study method, yet no AI tool has nailed the integration of content ingestion + FSRS scheduling. If you own retention, you own the student relationship long-term.

---

## STEP 7 — Strategic Moat Analysis

### Why YouLearn (and Similar Wrappers) Have a Weak Moat

Despite traction, the underlying architecture is strategically fragile:

- Features are **technically easy to replicate** — summarization, flashcard generation, and quiz creation are commodity LLM capabilities
- **No network effects** — the product is single-player; one user's activity doesn't make it better for another
- **No proprietary data advantage** — the content is user-uploaded, not platform-owned
- **Mostly a wrapper around LLM summarization and RAG** — defensibility depends on UX, not technology

**Implication:** Any product we build in this space must actively solve the moat problem — through network effects, proprietary data loops, or workflow lock-in.

---

## STEP 8 — Additional Product Opportunity Twists

Beyond the Top 5, the following differentiating angles could be built standalone or layered onto existing ideas:

---

### IDEA 6: AI Curriculum Builder — Goal-Driven Learning Paths

Instead of requiring the user to upload content:

- User provides a **learning goal** (e.g., "become job-ready in backend engineering")
- AI builds a **complete learning path** — sourcing materials, sequencing topics, setting milestones
- Continuously adapts the curriculum based on progress and knowledge gaps

**Why it matters:** Flips the model from "bring your own content" to "tell me what you want to know." Solves the cold-start problem that upload-first tools have.

---

### IDEA 7: Learning OS — Lifecycle Knowledge Management

A system that tracks:

- What you **know**
- What you've **forgotten** (decay modeling)
- What to **learn next** (gap analysis)

AI manages your **entire learning lifecycle** across subjects, time, and contexts. Not a study tool — a personal knowledge operating system.

**Why it matters:** Moves beyond session-based studying into continuous knowledge maintenance. Creates deep retention data that becomes a proprietary moat over time.

---

### IDEA 8: AI Mentor — Beyond Summaries Into Teaching

Move past summarization into real pedagogy:

- **Socratic teaching** — asks questions instead of giving answers
- **Adaptive difficulty** — scales challenge to the learner's level in real-time
- **Guided exercises** — scaffolded problem-solving, not just quizzes
- **Project feedback** — reviews learner output (essays, code, designs) with actionable critique

**Why it matters:** Current AI study tools are *reference tools*. An AI mentor is a *teaching tool*. The value gap between "here's a summary" and "let me teach you this" is enormous.

---

### IDEA 9: Learn From Real Work — Personal Workflow as Curriculum

Use **personal workflow data** instead of generic study material:

- Codebases → AI teaches architecture patterns and language features you actually use
- Work documents → AI identifies knowledge gaps in your domain
- Research notes → AI connects your ideas and surfaces what you're missing

AI teaches directly from your **real environment**, not from abstract textbooks.

**Why it matters:** Learning is most effective when contextual. This is the "learn by doing" approach automated. Also creates a strong data moat — deeply personal, non-transferable.

---

### IDEA 10: Social Learning Layer — Network Effects for Study

Add collaborative and competitive mechanics:

- **Shared knowledge graphs** — pool understanding across study groups
- **Collaborative study sessions** — real-time AI-mediated group learning
- **Ranked explanations** — community-generated answers scored by clarity and accuracy
- **Peer challenges** — quiz battles, leaderboards, streak mechanics

**Why it matters:** Directly solves the moat problem. Network effects mean the platform gets better with more users. Shared knowledge graphs create proprietary data. This is the missing ingredient in every current AI study tool.

---

## STEP 9 — Highest-Leverage Concept: AI Learning Graph

### The "GPS for Knowledge" Play

Core concept: **Map the entire knowledge space as a graph.**

- Nodes = skills, concepts, facts
- Edges = dependencies, prerequisites, relationships
- Overlay the learner's current knowledge state onto the graph
- **Detect knowledge gaps** automatically
- **Generate personalized learning paths** that are topologically optimal

Essentially: **GPS for knowledge** — you are here, you want to be there, here's the fastest route.

**Why this could be the strongest idea:**
- Creates a proprietary, compounding data asset (the knowledge graph itself)
- Enables every other product idea (curriculum builder, learning OS, mentor, cert prep) as applications on top of the graph
- Network effects: more learners → better graph → better paths for everyone
- Defensible: building a high-quality knowledge graph at scale is genuinely hard to replicate

---

## STEP 10 — Meta-Opportunity: AI Startup Research Agents

### Beyond Building a Learning Tool — Build the Discovery Engine

Instead of building another product in the learning space, consider the meta-play:

Build **AI startup research agents** that:

- **Scan communities** (Reddit, X, Hacker News, GitHub Issues, ProductHunt) for complaints, frustrations, and unmet needs
- **Cluster problems** — group similar complaints into validated problem themes
- **Detect demand signals** — measure pain intensity, frequency, willingness to pay from real user language
- **Score opportunities** — rank startup ideas by market size, competition gaps, and technical feasibility
- **Generate validated startup concepts** — complete with MVP specs, positioning, and validation strategies

**Why this matters:** The research process used to create *this document* is itself a repeatable, automatable workflow. An AI agent that continuously discovers startup opportunities is more valuable than any single startup idea it produces.

**Potential architecture:**
1. Community scraper agents (Reddit, X, HN, GitHub)
2. NLP clustering pipeline (group complaints into problem themes)
3. Demand scoring model (pain × frequency × urgency × WTP)
4. Competitor gap analyzer (what exists, what's missing)
5. Product concept generator (MVP feature set + positioning + validation plan)

---

## STEP 11 — Enhanced Discovery Methodology

### Multi-Role AI Research Pipeline

For future research iterations, structure the AI discovery process as:

| Role | Responsibility |
|------|---------------|
| **Problem Researcher** | Scan communities for real complaints, extract user quotes as evidence |
| **Market Analyst** | Size markets, map competitors, identify structural weaknesses |
| **User Researcher** | Score problems by pain intensity, frequency, urgency, willingness to pay |
| **Product Strategist** | Synthesize findings into product concepts, MVP specs, and validation plans |

### Required Research Steps

1. Multi-source demand signal collection (Reddit, X, HN, GitHub Issues, ProductHunt)
2. User quote extraction — real complaints as primary evidence
3. Competitor teardown with explicit weakness mapping
4. Opportunity scoring on 4 axes: pain intensity, frequency, urgency, WTP
5. Clear product concept with positioning statement
6. MVP feature set (build-this-first scope)
7. Validation strategy (landing page tests, waitlists, fake doors, community posts)

---

*Research compiled from: TrustPilot, Reddit (r/Step2, r/CollegeRant, r/CFA, r/GetStudying), ProductHunt, HackerNews, Gartner, Grand View Research, IMARC Group, SoftwareCurio, Skywork AI, and direct product analysis.*
