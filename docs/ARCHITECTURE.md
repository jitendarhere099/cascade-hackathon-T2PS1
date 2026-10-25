# System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (Next.js React Client Components, shadcn/ui, Tailwind)    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼ (Server Actions / APIs)      ▼ (Supabase Client w/ RLS)
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Next.js App Server      │ │     Supabase Backend       │
│  - Route Handlers            │ │  - Auth / JWT Session      │
│  - Input Validation (Zod)    │ │  - PostgreSQL Database     │
│  - Secure Server Logic       │ │  - Row Level Security      │
└──────────────┬───────────────┘ │  - Storage Buckets         │
               │                 └──────────────▲─────────────┘
               └────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) + React | Full-stack server and client application |
| **Language** | TypeScript | Static typing, maintainability, and contract enforcement |
| **Styling** | Tailwind CSS | Utility-first, responsive, and tokenized styling |
| **Component Library** | shadcn/ui | Accessible, customizable primitive UI components |
| **Iconography** | Lucide React | Clean, consistent icons |
| **Database & Auth** | Supabase (PostgreSQL) | Managed database, authentication, real-time sync, and storage |
| **Testing** | Playwright | End-to-end browser testing and user journey validation |

## Planned Directory Structure

```
d:\cascade-hackathon/
├── .agents/                    # Agent behavior definitions and rules
│   └── rules/                  # Workspace constraints
├── docs/                       # Project documentation and memory
│   ├── ARCHITECTURE.md
│   ├── PROJECT_BRIEF.md
│   ├── PROJECT_STATE.md
│   ├── DECISIONS.md
│   ├── API_REFERENCE.md
│   └── TESTING.md
├── src/                        # Application source code (post-scaffolding)
│   ├── app/                    # Next.js App Router (pages, layouts, route handlers)
│   ├── components/             # Reusable UI & shadcn components
│   │   └── ui/                 # Primitive components
│   ├── lib/                    # Supabase client helpers, utilities, schemas
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript interface and type declarations
├── supabase/                   # Supabase configuration & migrations
│   └── migrations/             # Versioned SQL migrations and RLS policies
├── tests/                      # Playwright E2E tests and test fixtures
├── .env.local                  # Local secrets (never committed)
├── .gitignore                  # Git ignore rules
├── AGENTS.md                   # Agent guidelines & publishing workflow
├── package.json                # Project dependencies and npm scripts
└── README.md                   # Main entry point documentation
```

## Security & Secrets Protocol
1. **Client-Safe Secrets**: Only variables prefixed with `NEXT_PUBLIC_` may be referenced in browser components (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
2. **Server-Only Secrets**: Any service role key or API secret must remain exclusively in server environments and never bundled in client code.
3. **Environment Files**: `.env`, `.env.local`, and any credential files are strictly excluded via `.gitignore`.
4. **Row Level Security**: Every table in Supabase must have Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and explicit `CREATE POLICY` statements.
