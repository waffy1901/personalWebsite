---
name: adversarial-change-verifier
description: Orchestrate adversarial, multi-agent regression verification for Waffy Ahmed's personalWebsite. Use when Codex is asked to spin up agents, run a team of agents, adversarially verify new or uncommitted changes, check regressions, validate all functionality, compare local or deploy-preview behavior against production, or perform broad post-change QA across routes, SEO, content, AI discovery, resume assets, analytics, CSP/security headers, visual layout, and deployed site behavior.
---

# Adversarial Change Verifier

## Core Workflow

1. Establish scope and safety.
   - Check `git status --short` before edits or verification.
   - Identify the target: uncommitted diff, branch, PR, local build, deploy preview, production, or a comparison between them.
   - Treat unrelated changes as user-owned. Stay in verification mode unless the user asks to fix, document, commit, push, or deploy.
   - If live browser QA is in scope, tell the user it can count as GA4 traffic. `curl`, Node HTTP checks, GitHub automation, and package audits do not run the site in a browser and should not affect GA4.

2. Load adjacent repo skills only when their surfaces are in scope.
   - Use `$portfolio-release-qa` for release readiness, lint/test/build, preview smoke checks, static assets, or Netlify deploy readiness.
   - Use `$seo-spa-auditor` for routes, redirects, canonical URLs, sitemap, robots, Open Graph/Twitter metadata, prerender shells, or SPA route behavior.
   - Use `$portfolio-content-sync` for profile, experience, projects, case studies, metrics, recruiter copy, route slugs, or public metadata.
   - Use `$ai-discovery-maintainer` for `llms.txt`, `ai-summary.txt`, `portfolio.json`, JSON-LD, structured data, or AI-agent guidance.
   - Use `$resume-site-sync` for resume PDF links, preview image, resume route behavior, or canonical resume assets.
   - Use `$csp-security-header-maintainer` for CSP, security headers, JSON-LD hashes, GA/Formspree allowlists, redirects, frames, or third-party connections.
   - Use `$ga4-portfolio-analytics` for GA4 events, page tracking, key-event candidates, or analytics tests.
   - Use `$portfolio-performance-auditor` for route splitting, image loading priority, asset delivery, layout stability, or Vite bundle output.
   - Use `$portfolio-audit-maintainer` for `docs/personal-website-repository-audit.md`, deployed evidence, finding classification, or audit provenance.
   - Use `$portfolio-github-automation-maintainer` for GitHub Actions workflows, Dependabot, CodeQL, deployed-header automation, or workflow-run behavior.

3. Build a lane plan from the diff and the user's wording.
   - Read [references/verification-lanes.md](references/verification-lanes.md) and select the smallest set of lanes that covers the risk.
   - For "all functionality", "fully functional", "regressions", or "spin up agents", run multiple independent lanes rather than one broad smoke test.
   - Prefer adversarial questions: what could this break, what changed indirectly, what route or asset would a crawler see first, what user action emits telemetry, what deploy-only behavior differs from local?

4. Use independent agents when available.
   - If multi-agent tools are available, search for them and spawn read-only agents with narrow prompts, raw artifacts, and no expected answer.
   - Give each agent one lane, such as diff-risk mapping, route/functionality smoke, SEO/crawler checks, content/AI/resume consistency, analytics/CSP/security review, visual/browser QA, or deployed HTTP verification.
   - Ask each agent for exact evidence, commands, routes, confidence, and residual risk. Do not ask agents to modify files unless the user explicitly requests fixes.
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
   - Include commands run, checks skipped, and whether live browser QA may have affected GA4.
   - If deployed findings must persist, update the repo audit artifact only when the user asks or the task explicitly includes audit documentation.
