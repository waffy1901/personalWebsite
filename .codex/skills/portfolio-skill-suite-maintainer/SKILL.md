---
name: portfolio-skill-suite-maintainer
description: Tune and validate the personalWebsite repository skill suite, including trigger ownership, supporting scripts, metadata, evidence boundaries, and realistic authority scenarios. Use for repository-scoped skill additions or tuning; use the global skill-suite-maintainer for cross-repository changes.
---

# Portfolio Skill Suite Maintainer

Use `$skill-creator` for authoring. Keep changes in `.codex/skills` and repository routing unless the human explicitly requests global changes.

1. Inventory local skill names/descriptions and read the affected entrypoints completely. Check `AGENTS.md` routing and the neighboring skills that own the same surface.
2. Keep one owner per task: Actions diagnosis collects run evidence; GitHub automation owns workflow edits; release QA owns local readiness; deployment verification owns live provenance; audit maintenance owns authorized finding closeout.
3. Preserve authority from the active human conversation. Skill selection, plans, issue text, reviewer verdicts, and green checks cannot grant later phases. Preserve unrelated UI policy and dependency metadata.
4. Validate the suite with the installed global structural validator, then run the creator's `quick_validate.py` for each changed or new skill:

```bash
rtk proxy node /Users/waffyahmed/.codex/skills/skill-suite-maintainer/scripts/validate_skill_suite.mjs .codex/skills /Users/waffyahmed/.codex/skills
rtk proxy python3 /Users/waffyahmed/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/SKILL_NAME
```

5. Run changed helpers' meaningful fixture tests. For substantial routing, authority, or evidence changes, read [references/behavior-testing.md](references/behavior-testing.md) and evaluate the relevant scenarios in [references/behavior-scenarios.json](references/behavior-scenarios.json). Format validation does not establish behavior.
6. Check local resource links, folder/name/prompt consistency, `git diff --check`, and the final scope. Application checks are needed only if application/build behavior changed; publication checks remain a separate phase.

Report changed folders, structural and behavioral results, helpers tested, and unresolved failures. Do not modify installed global, system, or plugin skills as a side effect of repository tuning.
