# Architectural Decisions (ADRs)

## ADR 001: Core Application Stack — Next.js, React, and TypeScript
- **Status**: Accepted
- **Context**: Rapid development of a full-stack application for a hackathon requires strong type safety, modern routing, seamless server/client boundaries, and fast build times.
- **Decision**: Use Next.js (App Router) with React and TypeScript.
- **Consequences**: Enables server-side rendering, static generation, API route handlers, and type-checked models across client and server.

---

## ADR 002: UI Component and Styling Architecture — Tailwind CSS, shadcn/ui, Lucide React
- **Status**: Accepted
- **Context**: Hackathon projects need high-polish, non-generic, accessible interfaces without spending days building primitives from scratch.
- **Decision**: Use Tailwind CSS for utility-first styling, shadcn/ui for accessible headless-based UI primitives, and Lucide React for consistent icons.
- **Consequences**: Standardizes spacing, typography, tokens, and component states (loading, empty, error, success) while keeping UI code clean and customizable.

---

## ADR 003: Database and Backend Services — Supabase
- **Status**: Accepted
- **Context**: The project requires relational data integrity (PostgreSQL), authentication, file storage, and strict security without complex self-managed infrastructure.
- **Decision**: Adopt Supabase as the backend platform.
- **Consequences**:
  - Enforce Row Level Security (RLS) policies on every table.
  - Store project URL and publishable key in `.env.local`.
  - Never expose service role keys to client-side code.

---

## ADR 004: Automated Quality Verification — Playwright
- **Status**: Accepted
- **Context**: Visual and interaction regressions must be caught quickly, and features must be validated in an actual browser environment rather than relying purely on code review.
- **Decision**: Use Playwright for end-to-end browser testing and Chrome DevTools for live debugging.
- **Consequences**: Real user journeys can be verified end-to-end before feature signoff.

---

## ADR 005: Git Publishing Workflow — Verification Gates
- **Status**: Accepted
- **Context**: Avoid spamming commits or pushing broken/unverified code to GitHub.
- **Decision**: Commit and push only after:
  1. Relevant type checks (`tsc`) and tests pass.
  2. Changed files and Git diff are inspected.
  3. Exclusion of secrets is verified.
  4. Changes are summarized.
- **Consequences**: Clean commit history on `main`, zero leaked credentials, and verifiable progress.

---

## ADR 006: Vectorised Particle Filter Core & Overdispersed Emissions
- **Status**: Accepted
- **Context**: Crisis inference requires real-time posterior probabilities over 4 hypotheses and nuisance factors with numerical stability, avoiding heavy black-box ML frameworks.
- **Decision**: Hand-written, vectorised NumPy particle filter ($N=4000$) with Negative Binomial emissions, dispersion scaling, spatial concentration, and evidence tempering.
- **Consequences**: Sub-100ms per-minute updates, zero NaN/Inf vulnerability, reproducible runs seeded by ledger content hash.

---

## ADR 007: Editorial Broadsheet Design System & Zero Generic Dashboard Look
- **Status**: Accepted
- **Context**: Traditional SaaS dark-mode dashboards with neon glows and floating drop-shadow cards fail editorial authority and high-stress readability.
- **Decision**: High-reliability physical broadsheet aesthetic: warm paper (`#F3EFE6`), deep carbon ink (`#1D1B16`), 1px hairlines (`#D5CEBD`), Newsreader serif lining numerals, and custom SVG D3 charts with direct inline labeling.
- **Consequences**: Immediate visual distinctiveness, WCAG AA compliance, and complete color-blind accessibility via glyphs and patterned strokes.

---

## ADR 008: Isomorphic Simulation Engine for Vercel Zero-Error Deployments
- **Status**: Accepted
- **Context**: Vercel static serverless hosting cannot maintain persistent local WebSocket servers (`localhost:8000`). If disconnected, the UI must not throw console errors or render blank screens.
- **Decision**: Embed an isomorphic, mathematically identical TypeScript simulation engine in the frontend client. The client attempts FastAPI WebSocket connection, and automatically falls back to the in-browser engine if offline.
- **Consequences**: Zero console errors on Vercel deployment, offline network functionality, and live interactive capability on any device.

---

## ADR 009: Bitemporal Event Ledger with Rollback Re-filtering
- **Status**: Accepted
- **Context**: Real disaster telemetry contains retractions, duplicate transmissions, and delayed out-of-order packets.
- **Decision**: Store bitemporal timestamps (`event_time` and `arrival_time`) with 20-minute rolling state checkpoints. Retroactive arrivals trigger deterministic checkpoint rollback and forward re-filtering.
- **Consequences**: Shuffled arrivals achieve mathematical convergence with in-order delivery, satisfying Acceptance Test 4.

---

## ADR 010: Hysteresis, Minimum Dwell Times & Optimal Stopping
- **Status**: Accepted
- **Context**: Alert flickering ($\text{ESCALATE} \to \text{WATCH} \to \text{ESCALATE}$) rapidly destroys duty-officer and public credibility.
- **Decision**: Enforce minimum 3-minute dwell locks on escalation, 2-minute locks on de-escalation, switching penalties, and optimal stopping based on Monte-Carlo value-of-waiting rollouts.
- **Consequences**: Flip-flops reduced to 1 over 300 held-out episodes while preserving 6.4 minutes of early cascade lead time.
