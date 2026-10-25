# cascade-hackathon
Just a project

---

## Overview
A production-ready full-stack web application repository engineered for high reliability, clean architecture, and rapid feature iteration.

## Technology Stack
- **Frontend**: [Next.js](https://nextjs.org/) + [React](https://react.dev/) (App Router, TypeScript)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, Auth, Storage)
- **Testing**: [Playwright](https://playwright.dev/) for automated browser testing, TypeScript static checks, ESLint

## Repository Structure
```
├── .agents/               # Agent rules and persistent behaviors
│   └── rules/             # Rule markdown files (engineering, design, testing)
├── docs/                  # Long-term project memory and architecture docs
│   ├── PROJECT_BRIEF.md   # Project scope, requirements, and user goals
│   ├── ARCHITECTURE.md    # System architecture, tech stack, and file paths
│   ├── PROJECT_STATE.md   # Current status, change log, and next steps
│   ├── DECISIONS.md       # Architectural Decision Records (ADRs)
│   ├── API_REFERENCE.md   # API route contracts and database schema
│   └── TESTING.md         # Testing procedures and quality gates
├── AGENTS.md              # Instructions and GitHub publishing protocol for AI agents
└── README.md              # Project documentation entry point
```

## Getting Started

### Prerequisites
- Node.js (v20+ recommended, currently running v24.x)
- npm (v10+ recommended)
- Git

### Environment Configuration
Local environment variables must be stored in `.env.local` and never committed to Git:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### Development Commands
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run type checks
npx tsc --noEmit

# Run tests
npm test
```

## Contributing & Agent Guidelines
Refer to [AGENTS.md](file:///d:/cascade-hackathon/AGENTS.md) and [`docs/PROJECT_STATE.md`](file:///d:/cascade-hackathon/docs/PROJECT_STATE.md) for active task tracking, code quality standards, and the GitHub publishing workflow.
