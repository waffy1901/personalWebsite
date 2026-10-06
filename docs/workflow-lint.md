# Workflow linting

Every pull request to `main` runs the required-check candidate named `Lint GitHub Actions workflows`. It checks every direct `.yml` and `.yaml` file in `.github/workflows` for workflow syntax, expressions, invalid job references, and embedded shell diagnostics. It does not use path filters, secrets, or publishing permissions.

Run the same check locally from the repository root:

```bash
npm run lint:workflows
```

`scripts/check-workflows.sh` downloads actionlint `1.7.12` (release commit `914e7df21a07ef503a81201c76d2b11c789d3fca`) and ShellCheck `0.11.0` from their official GitHub releases for supported Linux and macOS x86-64 or ARM64 hosts. The authoritative platform-specific SHA-256 values live beside the platform selection in that script. It verifies both archives before extraction or execution, checks itself with the pinned ShellCheck, and then runs actionlint with that ShellCheck binary. Pyflakes is intentionally disabled because this check owns the shell lane; Python validation remains with the repository's existing focused tests. No actionlint diagnostic is ignored, and the repository's current Actions references are accepted without suppression.

To update either tool, change its version, official archive URL pattern, and all four platform checksums together in `scripts/check-workflows.sh`. Verify the release provenance and archives upstream, then run the local command and repeat the negative diagnostic and checksum-failure checks described in Issue #219 before publishing the change. Update the pinned version notes in this document and the GitHub automation map in the same change.

All active third-party actions are pinned to reviewed full commit SHAs with an adjacent full release comment, such as `# v7.0.1`. Dependabot's root GitHub Actions group owns routine update proposals for those references. For each proposal, verify the official release tag and immutable commit, update the `uses` SHA and version comment together, and keep checkout credential persistence disabled unless a reviewed job must write through Git.

Keep workflow permissions deny-by-default or read-only at the workflow level. Grant write access only to the job that performs the corresponding API operation, and retain only the permission keys that operation requires.

The local command proves the checked-in workflows pass the pinned static analyzers. Required-check status, runner behavior, and hosted annotations need evidence from a pull request run before the issue can be closed.
