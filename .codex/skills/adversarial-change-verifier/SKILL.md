---
name: adversarial-change-verifier
description: Coordinate adversarial verification for Waffy Ahmed's personalWebsite when the user requests an agent team or adversarial verification, or concrete T2/T3 risk requires independent checks across coupled surfaces. Ordinary regression checks, uncommitted-change reviews, and release smoke tests should use the focused review or domain skill unless that broader risk is established.
---

# Adversarial Change Verifier

## Core Workflow

Only the coordinator plans lanes or delegates work. If assigned one QA lane, act as a worker: inspect that lane's artifacts, use only its relevant domain skills, and return evidence. Do not run the coordinator workflow or delegate further.

1. Establish scope and safety.
   - Check `git status --short` before edits or verification.
   - Identify the target: uncommitted diff, branch, PR, local build, deploy preview, production, or a comparison between them.
   - Treat unrelated changes as user-owned. Stay in verification mode unless the user asks to fix, document, commit, push, or deploy.
   - Use `$telemetry-safe-browser-qa` before browser navigation on localhost, deploy previews, or production. Configured analytics and forms can reach real services from any hostname; apply the required blocking or test destinations before loading the page.

2. Load adjacent repo skills only when their surfaces are in scope.
   - Use `$portfolio-release-qa` for release readiness, lint/test/build, preview smoke checks, static assets, or Netlify deploy readiness.
   - Use `$seo-spa-auditor` for routes, redirects, canonical URLs, sitemap, robots, Open Graph/Twitter metadata, prerender shells, or SPA route behavior.
   - Use `$portfolio-content-sync` for profile, experience, projects, case studies, metrics, recruiter copy, route slugs, or public metadata.
   - Use `$ai-discovery-maintainer` for `llms.txt`, `ai-summary.txt`, `portfolio.json`, JSON-LD, structured data, or AI-agent guidance.
   - Use `$resume-site-sync` for resume PDF links, preview image, resume route behavior, or canonical resume assets.
   - Use `$csp-security-header-maintainer` for CSP, security headers, JSON-LD hashes, GA/Formspree allowlists, redirects, frames, or third-party connections.
   - Use `$ga4-portfolio-analytics` for GA4 events, page tracking, key-event candidates, or analytics tests.
   - Use `$portfolio-performance-auditor` for route splitting, image loading priority, asset delivery, layout stability, or Vite bundle output.
   - Use `$portfolio-audit-maintainer` for GitHub quality findings and project state, `docs/quality-and-verification-policy.md`, deployed evidence, finding classification, or archived audit provenance.
   - Use `$portfolio-github-automation-maintainer` for GitHub Actions workflows, Dependabot, CodeQL, deployed-header automation, or workflow-run behavior.

3. Build a lane plan from the diff and the requested verification scope.
   - Read [references/verification-lanes.md](references/verification-lanes.md) and select the smallest set of lanes that covers the risk.
   - Use multiple independent lanes for an explicit team/adversarial request or a concrete T2/T3 risk that requires them. Generic wording such as "regressions" or "all functionality" alone does not justify delegation. Route ordinary checks to the focused review or domain skill.
   - Prefer adversarial questions: what could this break, what changed indirectly, what route or asset would a crawler see first, what user action emits telemetry, what deploy-only behavior differs from local?

4. Delegate only the selected independent lanes.
   - When the lane plan justifies delegation and multi-agent tools are available, the coordinator may spawn read-only workers with narrow prompts, raw artifacts, and no expected answer. Use the smallest useful set of workers and avoid overlapping assignments.
   - Give each agent one lane, such as diff-risk mapping, route/functionality smoke, SEO/crawler checks, content/AI/resume consistency, analytics/CSP/security review, visual/browser QA, or deployed HTTP verification.
   - Ask each agent for exact evidence, commands, routes, confidence, and residual risk. State that workers must not delegate further or invoke this coordinator workflow. Do not ask agents to modify files unless the user explicitly requests fixes.
   - If subagents are unavailable, run the same lanes sequentially and keep the notes separated.

5. Verify with evidence.
   - Run the narrowest meaningful checks first, then broaden to `npm run lint`, `npm run test`, and `npm run build` as risk requires.
   - Use repo checkers from the adjacent skills when public content, SEO, AI discovery, resume assets, analytics, CSP, or release readiness are in scope.
   - For deployed checks, use authoritative URLs from production or the deploy preview. Do not treat local preview evidence as proof of live behavior.
   - For 404 checks, avoid `curl -f` so the body remains available for `noindex, nofollow` verification.

6. Report like a review.
   - Lead with findings ordered by severity, with file/route/command evidence.
   - Separate true regressions from caveats and nitpicks in practical language.
   - If no issues are found, say so clearly and mention remaining test gaps or live checks not run.
   - Include commands run, checks skipped, and the browser telemetry controls used on each environment; identify any unblocked traffic that may have affected GA4.
   - If findings must persist, create or update the corresponding GitHub issue and project item only when the user asks or the task explicitly includes tracking updates. Never rewrite the archived audit as current state.
