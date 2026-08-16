# Portfolio Quality and Verification Policy

This document defines how repository findings are classified, tracked, verified,
and closed. It intentionally contains no changing issue counts, priorities, or
release status.

## Sources of Truth

- The [Portfolio Quality & Improvements project](https://github.com/users/waffy1901/projects/2)
  is the operational view of planned and active work.
- Repository issues are the durable record for individual findings, discussion,
  acceptance criteria, and closure evidence.
- Pull requests, workflow runs, GitHub releases, and deploy tags preserve
  implementation and release history.
- The [Aug 15, 2026 audit snapshot](audit-archive/personal-website-repository-audit-2026-08-15.md)
  is historical evidence only and must not be updated.

Project-only draft items are not used for actionable findings. Every finding
must have a repository issue so it remains searchable, linkable from pull
requests, and independently closable.

## Finding Contract

Use a stable finding ID such as `F-018` in the issue title. Before creating a
new ID, search open and closed issues to avoid duplicates or reopening work that
current evidence already resolved.

Each finding issue must include:

- a concise problem statement and practical user or engineering impact;
- severity, priority, and affected area;
- exact files, routes, settings, or external systems in scope;
- dated evidence and its evidence class;
- testable acceptance criteria;
- the verification required before closure; and
- links to related issues, pull requests, releases, or workflow runs.

Severity and priority are separate:

- **Severity** describes impact: Critical, High, Medium, Low, or Informational.
- **Priority** describes scheduling: Now, Next, or Later.

Do not promote hypotheses, preferences, or unverified external claims into
findings. Record them as issue discussion or a clearly labeled investigation
until evidence establishes actionable impact.

## Project Workflow

The project uses these status meanings:

- **Backlog:** valid work that is not yet scheduled.
- **Ready:** scoped work with testable acceptance criteria.
- **In progress:** implementation or investigation is active.
- **Validation:** implementation is complete but required evidence is pending.
- **Blocked:** progress requires an identified external decision or dependency.
- **Done:** the issue satisfies its closure contract and is closed.

The intended supporting fields are:

- **Priority:** Now, Next, Later.
- **Severity:** Critical, High, Medium, Low, Informational.
- **Area:** Accessibility, Analytics, Content / AI discovery, Governance,
  Performance, Privacy, Security / Automation, SEO / Architecture, or another
  narrowly justified area.
- **Evidence needed:** Source, Local checks, Production HTTP, Browser, External
  account, or an explicit combination.

Recommended views are `Now`, `By area`, `Needs validation`, and `Recently done`.
Built-in automation should set newly added items to Backlog and closed issues or
merged pull requests to Done.

## Evidence Classes

Keep evidence types distinct because they prove different things:

- **Source:** repository code, configuration, and generated-source contracts.
- **Local checks:** focused validators, lint, tests, production build, and local
  preview behavior.
- **Production HTTP:** deployed status codes, redirects, initial HTML, headers,
  and public artifact bytes.
- **Browser:** hydrated behavior, accessibility interactions, layout, console,
  and network observations at stated viewport and browser versions.
- **External account:** authenticated GitHub, Netlify, GA4, Search Console,
  Formspree, or other provider settings.

Local success does not prove Netlify routing, deployed headers, browser behavior,
analytics receipt, or account settings. Production claims require the exact
target URL and deployment provenance.

## Closure Contract

A finding can be closed only when its issue contains or links to:

1. the implemented change or documented decision;
2. the required focused and broad checks;
3. the merged pull request and merge commit when code changed;
4. the deploy tag and workflow run when production behavior changed;
5. the validation date, target, and evidence classes exercised; and
6. explicit residual gaps or follow-up issues.

When browser or external-account evidence is unnecessary, say so instead of
implying it was exercised. Close obsolete or rejected work with a clear reason;
do not silently delete its history.

## Telemetry and Production Safety

Browser QA against `waffy.dev` can create GA4 traffic. Prefer analytics-disabled
local testing or intercept analytics hosts when analytics delivery is outside
scope. HTTP, source, build, package, and workflow checks do not execute the
production application JavaScript and should not create GA4 page views.

Never submit the real contact form without explicit approval. Distinguish a
rendered or mocked form check from a real Formspree delivery claim.

For unknown-route checks, preserve the response body so `noindex, nofollow` can
be inspected. For crawler-visible metadata, inspect initial HTML and generated
route shells rather than relying only on hydrated document state.

## Maintenance

- Update the issue and project state instead of adding current-status prose to
  repository documentation.
- Link pull requests with a closing keyword when they fully satisfy an issue.
- Put shared verification rules here; keep finding-specific evidence in its
  issue.
- Preserve exact dates, PR numbers, commit hashes, deploy tags, workflow IDs,
  URLs, and telemetry boundaries.
- Recheck current repository, deployment, and provider state before replacing
  pending language with a verified claim.
