---
name: portfolio-change-impact
description: Map current, staged, or supplied file changes in Waffy Ahmed's personalWebsite to affected content, SEO, resume, AI discovery, analytics, CSP, and frontend performance surfaces; required synchronization work; adjacent repo skills; and the minimal existing validators. Use when planning or reviewing validation for a diff, deciding which portfolio integrity checks to run, or maintaining the scope-aware pre-commit hook. Do not use as a full release, push, or deploy gate.
---

# Portfolio Change Impact

Use the bundled checker as the source of truth for diff-to-validator routing. It keeps the skill and Git pre-commit hook on one mapping.

## Map Changes

From the repository root, inspect the full worktree without running checks:

```bash
node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs --source worktree
```

Inspect the staged commit instead:

```bash
node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs --source staged
```

Use the output to identify affected surfaces, required synchronization, adjacent skills, and the minimal validator set. Load only the adjacent skills needed for the task.

## Run Focused Checks

Validate the current worktree:

```bash
node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs --source worktree --check
```

Validate the exact staged snapshot:

```bash
node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs --source staged --check
```

Staged mode materializes the Git index in a temporary directory, so partially staged files do not contaminate the result.

## Boundaries

- Keep lint, unit tests, and the production build in `$portfolio-release-qa` and the pre-push gate.
- Treat a passing focused check as proof of its named invariant only, not full release readiness.
- Run `--self-test` after changing the routing table.
