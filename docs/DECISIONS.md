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
