# Testing & Verification Guide

## Testing Philosophy
Every feature must be verified with actual test execution before reporting completion. Never claim a feature is complete without running verification commands.

## Quality Gates

Before declaring any feature ready or pushing code to GitHub, verify these gates:

```
[1] Static Analysis       -> npx tsc --noEmit && npm run lint
[2] Unit / E2E Tests      -> npm test / npx playwright test
[3] Secrets Check         -> git diff --cached (verify no .env or API keys)
[4] Browser Inspection    -> Verify live UI behavior and visual states
```

## Testing Procedures

### 1. Static Type Checking
```bash
npx tsc --noEmit
```
- Must produce 0 errors.
- Never use `@ts-ignore` without explicit documentation of why it is required.

### 2. Linting & Formatting
```bash
npm run lint
```

### 3. End-to-End Browser Testing (Playwright)
```bash
# Run all Playwright tests
npx playwright test

# Run tests in UI mode (interactive debugging)
npx playwright test --ui

# Inspect test report
npx playwright show-report
```

### 4. Interactive Browser Verification
- Use Chrome DevTools MCP or open `http://localhost:3000` to manually verify:
  - Responsive layouts (mobile, tablet, desktop).
  - Component states: loading spinners/skeletons, empty illustrations, error alerts, and success confirmations.
  - Form validation with invalid/edge-case inputs.
  - Keyboard navigation and accessible focus indicators.

### 5. Git Pre-Commit Secret Audit
```bash
git status
git diff --cached
```
- Ensure no `.env`, `.env.local`, or raw API keys/tokens appear in tracked files.
