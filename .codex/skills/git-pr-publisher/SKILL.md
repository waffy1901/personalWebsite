---
name: git-pr-publisher
description: Publish local repository changes as a focused GitHub pull request. Use when Codex is asked to stage files, commit changes, push the current or dev branch, create or update a PR against main, prepare PR title/body text, or safely ship local changes after implementation.
---

# Git PR Publisher

## Overview

Publish a local branch to GitHub with a reviewable commit and pull request. Optimize for preserving user-owned work, staging only intended files, verifying the branch before publishing, and creating a clear PR against `main`.

## Workflow

1. Inspect the worktree before changing Git state.
   - Run `git status --short` and identify modified, deleted, and untracked files.
   - Run `git branch --show-current` and confirm the current branch is not `main`.
   - Treat unrelated user changes as out of scope. Do not revert them.
   - If the current branch is `main`, stop and ask whether to create or switch to a feature/dev branch.

2. Review the intended diff.
   - Use `git diff --stat` and targeted `git diff -- <path>` for changed tracked files.
   - Inspect untracked files before staging them.
   - If the user did not explicitly define the scope and the worktree contains unrelated changes, summarize the candidate files and ask before staging.

3. Verify before committing.
   - Follow repository instructions such as `AGENTS.md` and any task-specific skill checks.
   - For this portfolio repository, use `$portfolio-release-qa` for release, push, or deploy readiness.
   - For docs-only or instruction-only changes, note why lint/tests/build were not necessary.
   - If relevant checks fail, fix only failures clearly caused by the current change. Otherwise report the failure and stop before pushing unless the user explicitly asks to continue.

4. Stage deliberately.
   - Stage specific files with `git add -- <path> ...`.
   - Avoid `git add .` unless the user explicitly requests all current changes and the diff has been reviewed.
   - After staging, run `git diff --staged --stat` and inspect the staged diff enough to confirm it matches the intended scope.
   - If nothing is staged, stop and tell the user there is nothing to commit.

5. Commit clearly.
   - Use a concise imperative commit message that describes the change.
   - Prefer a single focused commit for one coherent change. Split commits only when the staged work contains logically separate changes.
   - Do not amend, rebase, reset, or force-push unless the user explicitly asks.

6. Push the branch.
   - Use the current branch name as the head branch.
   - If no upstream is set, push with `git push -u origin <branch>`.
   - If an upstream exists, use `git push`.
   - Do not push directly to `main`.
   - Do not force-push unless the user explicitly asks and the risk is explained.

7. Create or update the PR.
   - Use the GitHub connector/app when available for PR creation and metadata. Use `gh` as a fallback when connector coverage is unavailable.
   - Check for an existing PR for the branch before creating a duplicate.
   - Default base branch: `main`.
   - Default head branch: current branch.
   - Create a draft PR only if the user asks for draft or the branch is intentionally not ready for review.
   - Write a PR body with a short summary, verification performed, and any known risks or skipped checks.

## PR Body Shape

```markdown
## Summary
- ...

## Verification
- ...

## Notes
- ...
```

Omit `Notes` when there are no caveats. Include skipped checks under `Verification` rather than hiding them.

## Final Response

Report the commit hash, pushed branch, PR URL, checks run, and any skipped checks. In the Codex app, emit the required Git action directives after successful staging, commit, push, or PR creation.

If the user changes their mind mid-request, honor the newest instruction and stop before taking irreversible Git actions.
