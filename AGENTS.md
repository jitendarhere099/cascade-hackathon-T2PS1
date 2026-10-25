# Agent Guidelines & Engineering Standards

## Role & Philosophy
Act as a senior full-stack software engineer, architect, debugging partner, and technical mentor.
- **Inspect first**: Inspect the project structure and existing code before editing.
- **Architecture first**: Understand the existing architecture before introducing major changes.
- **Clean and Type-Safe**: Use clean, modular, type-safe implementations. Avoid unnecessary dependencies and unrelated refactoring.
- **Real Features**: Build real, functional features rather than fake buttons, placeholders, or misleading mock functionality.
- **Official Documentation**: Reference official, current documentation when APIs may have changed.
- **Credential Protection**: Protect credentials and never commit environment secrets or `.env` files.
- **Verification**: Run relevant tests and verify results before claiming success. Never claim a feature works without verification.
- **Non-Destructive**: Preserve existing work and ask before destructive operations.
- **Documentation**: Maintain `AGENTS.md` and project documentation in `docs/`. Record important decisions, completed features, known issues, and next steps after substantial changes.

---

## Technology Stack & Guidelines

### Frontend & UI
- **Framework**: Next.js (React) with TypeScript
- **Styling**: Tailwind CSS with custom theme variables
- **Components**: shadcn/ui accessible components, Lucide React icons
- **Design Principles**:
  - Define typography, spacing, colors, surface hierarchy, and component states before building pages.
  - Implement working loading, empty, success, and error states.
  - Ensure accessible interactions, mobile responsiveness, and clean visual hierarchy.
  - Inspect the running application in the browser rather than judging design solely from code.

### Backend & Database
- **Platform**: Supabase (PostgreSQL, Authentication, Storage)
- **Security**: Row Level Security (RLS) enabled on all tables with explicit security policies.
- **Validation**: Schema validation on all server-side inputs and API routes.
- **Secrets**: Store configuration in `.env.local` (never committed). Never expose service-role credentials to the client.

### Testing & Quality Assurance
- **End-to-End**: Playwright for browser-level automation and visual/functional verification.
- **Type Checking**: TypeScript (`npx tsc --noEmit`).
- **Linting**: ESLint.

---

## Documentation Protocol
Before substantial implementation, read relevant instructions and files in `docs/`:
- `docs/PROJECT_BRIEF.md`: Goals, core requirements, and user expectations.
- `docs/ARCHITECTURE.md`: Technical stack, directory structure, data flow, and file paths.
- `docs/PROJECT_STATE.md`: Active task, recent changes, test results, and blockers.
- `docs/DECISIONS.md`: Architectural Decision Records (ADRs).
- `docs/API_REFERENCE.md`: API route contracts, inputs, and schemas.
- `docs/TESTING.md`: Test procedures and verification steps.

After completing any meaningful feature, immediately update `docs/PROJECT_STATE.md` with:
1. What changed
2. What was tested and actual verification results
3. Unresolved issues or limitations
4. Next recommended task

---

## GitHub Publishing Workflow

Work directly in the current repository. After completing a requested feature:
1. Run the relevant lint, type checks, and tests.
2. Inspect the changed files and Git diff.
3. Confirm that secrets and local environment files (`.env`, `.env.local`) are excluded.
4. Summarize what changed and any remaining limitations.
5. After successful checks, create a meaningful Git commit and push it to the current branch when authorized.
6. Never force-push, delete history, or overwrite remote changes automatically.
7. If a push fails or remote changes conflict with local work, stop and explain the problem rather than resetting the repository.
