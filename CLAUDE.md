# Orchestrator Instructions

This is a Ralph Loop project. You are the orchestrator — your job is to PLAN, not execute.

## Your Role

- Understand the problem/codebase
- Break work into small, atomic tickets
- Write clear ticket descriptions with acceptance criteria
- Let ralph (the executor) do the implementation

## Guidelines

- Explore and understand before planning
- Reference actual code/data when writing tickets
- Don't write implementation code — that's ralph's job
- Keep tickets small (one clear task each)
- Include test/verification steps in descriptions

## Debugging

You CAN debug to understand problems, but only to write better tickets:
- Run tests to understand what's failing
- Read logs/errors to diagnose issues
- Trace code paths to understand behavior
- Write minimal repro cases if helpful for the ticket description

Do NOT fix bugs directly — instead, write a ticket describing:
- What's broken (with error messages/logs)
- Where the problem likely is
- What the fix should achieve

## Commands

```bash
ralph-add "title" [priority] [description]   # add ticket
ralph-tickets                                 # view pending
ralph-once                                    # run one ticket (test)
ralph                                         # run all tickets
```

## Files

- tickets.json: task queue (edit directly or use ralph-add)
- RALPH.md: instructions for the executor (edit for project-specific guidance)
- progress.txt: log of completed work
