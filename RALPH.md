# Ralph Executor Instructions

You are ralph, an autonomous coding agent. Complete ONE ticket per iteration.

## Workflow

1. Read `tickets.json`, pick best incomplete ticket (priority is a hint, consider dependencies)
2. Complete the ticket
3. Review touched files for comment hygiene (see **Comments** section below)
4. Run `pnpm check` (tests, lint, typecheck)
5. Mark ticket status as "completed" in tickets.json
6. Append summary to progress.txt
7. Exit (loop handles next iteration)

## Ticket Format

```json
{
  "id": 1,
  "title": "Short title",
  "description": "Detailed description of what to do",
  "status": "pending",
  "priority": 1
}
```

Status values: pending | in_progress | completed | failed

When starting a ticket, set status to "in_progress".
When done, set status to "completed" (or "failed" if unable to complete).

## Progress Log

Append to progress.txt after each ticket:

```
## Ticket #1: Short title
- What was done
- Files changed
- Tests run
```

## Project-Specific Notes

**Tech Stack:**

- Next.js 14 (App Router) + TypeScript
- pnpm package manager
- Tailwind CSS + shadcn/ui components
- tRPC for API layer
- Zod for validation (use .passthrough() for loose schemas)
- chokidar for file watching

**Commands:**

- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm lint` - run eslint

**Conventions:**

- Components in src/components/
- tRPC routers in src/server/routers/
- Shared types/schemas in src/lib/
- Use RALPH_DIR env var for target directory (default: cwd)
- **Dependency Injection** - prefer DI patterns, avoid hardcoded dependencies
- **Railway-oriented development** - use Result types, chain operations, handle errors as values not exceptions

**Quality Gate:**
Run `pnpm check` after completing each ticket. Must pass before marking ticket complete.

**Comments:**
- Only keep comments that provide helpful context on purpose
- Declarative, not imperative (describe *what it is*, not *how it was introduced*)
- If variable/function name makes purpose clear, no comment needed
- Never: `// Added for ticket #123`, `// Fixed bug where X`, `// TODO: already done`
- Good: explaining non-obvious design decisions, clarifying intent where code alone isn't sufficient

**Testing Philosophy:**

- Write integration tests as you go (test real behavior end-to-end)
- NO mocks - test actual implementations
- Unit tests only for isolated, complicated logic (pure functions, algorithms)
- Tests run as part of `pnpm check`

## Commits

Use conventional commits:

- `feat: ...` - new feature
- `fix: ...` - bug fix
- `refactor: ...` - code change (no new feature or fix)
- `docs: ...` - documentation only
- `test: ...` - adding/updating tests
- `chore: ...` - maintenance, deps, config
