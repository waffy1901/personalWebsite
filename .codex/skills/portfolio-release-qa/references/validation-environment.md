# Validation Environment and Install Provenance

Read the current `main/package.json`, lockfile, workflow Node pins, and
`netlify.toml`. The current pin is Node 22.22.3; the package minimum is 22.22.2.
Resolve the installed runtime path instead of assuming the login shell uses the
same Node as CI. Prefer the bundled runtime or an already installed compatible
runtime; changing global runtimes is not necessary for validation.

```bash
rtk proxy node .codex/skills/portfolio-release-qa/scripts/check_validation_environment.mjs /path/to/personalWebsite
```

The diagnostic compares the executing Node to the Netlify pin and each package's
declared direct dependencies to its lockfile entries. Packages with no declared
dependencies do not need a lockfile or installed modules. A mismatch or
missing package detects an unreliable environment. A match is a narrow diagnostic:
it does not prove transitive integrity, peer resolution, native compatibility,
install provenance, or matching browser binaries.

## When a clean isolated install is needed

Use an isolated `npm ci` with the pinned runtime for authoritative checks when:

- manifests/lockfiles changed or a dependency/security conclusion is in scope;
- installed versions or runtime differ from the lock/pin;
- the install's origin is unknown and its results are being used for publication;
- browser checks may use a Playwright package or browser cache from an older lock;
- a failure plausibly comes from stale modules or platform-specific install state.

Routine checks in a known, unchanged install may use the existing checkout.
Do not repeat a successful clean verification without a new change or unresolved
concern. Keep the hook's existing lint/test/build contract unchanged.

## Isolate the exact source being checked

Create a uniquely owned temporary directory. For committed targets, a read-only
Git archive of the exact SHA is sufficient. For working changes, copy the intended
source snapshot including relevant untracked files, excluding `.git`, installed
modules, build outputs, caches, and secrets. Record the source SHA and local diff;
an archive of HEAD alone does not contain uncommitted work. Keep unrelated user
work intact and do not run `npm ci` in their shared checkout to repair it.

Install from each dependency-bearing package's own lockfile for the checks being
run: `main` for app and browser work. `operations` currently declares no
dependencies and uses the tooling installed in `main`, so it needs no separate
install; run its checks through the root scripts. If it later declares dependencies,
validate those against its own lockfile and install them in the isolated snapshot.
Use the pinned runtime consistently for install and all checks. In the isolated
snapshot, run root lint/test/build for publication readiness and the narrow
focused checks selected by change impact. Record runtime, source, lockfile,
install, and command outcomes. This local evidence does not establish production.

For browser work, install the required engine through that isolated checkout's
locked Playwright CLI, then use its test commands. Match the package and browser
binaries; an old shared browser cache is not evidence for the newly locked engine.
Apply `$telemetry-safe-browser-qa` before live browsing. Hosted WebKit does not
establish real Safari/iOS behavior, and WebKit's missing numeric layout-shift
metric is not a measured CLS of zero.

If network or runtime restrictions block the clean install, report the gap.
Do not silently replace the requested lockfile with an existing cached install.
Delete only the temporary directory created for this check, after preserving any
required evidence.

Test the read-only diagnostic with:

```bash
rtk proxy node --test .codex/skills/portfolio-release-qa/scripts/test_validation_environment.mjs
```
