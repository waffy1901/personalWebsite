# Portfolio Feedback Roadmap

This note captures outstanding portfolio work from recent review feedback and the earlier ROI list. The common theme is clear: the codebase is already solid, so the next gains come from credibility polish, information hierarchy, and making production impact visible faster.

## Core Takeaway

The portfolio already signals care through React/Vite structure, routing, SEO, analytics, tests, deployment hygiene, and data-driven content. The main opportunity is not adding a large new feature. It is surfacing the strongest evidence sooner:

- platform and reliability ownership
- Kubernetes, observability, and incident-response work
- quantified production impact
- recruiter-friendly proof points in the first few seconds

## Highest Priority

### 1. Keep Trust-Risk Wording Tight

The Job Search Aid project copy has been revised so it does not imply that Firestore stores user passwords.

Recommended wording:

> Used FirebaseAuth for email/password authentication and Firestore for user profile metadata, saved jobs, and preferences.

Why it matters: even imprecise wording here can create a serious security trust concern. Keep future edits aligned with this distinction.

### 2. Add Homepage Metrics Strip

Add a compact metrics strip directly under the homepage hero/intro.

Suggested metrics:

- 40% latency reduction
- 89% error reduction
- 34.8M weekly requests
- 60+ repositories
- 500+ stores

Why it matters: the homepage currently reads as "solid engineer," while the experience data supports "platform/reliability engineer with production ownership." The homepage should make that leap immediately.

### 3. Custom Domain Follow-Through

The portfolio now uses `waffy.dev` as its canonical domain. Keep the old
`waffy.netlify.app` address only as a compatibility source for permanent
redirects, especially resume links that may already be shared externally.

Why it matters: the credibility-polish win is mostly complete, but the
post-migration checks still matter: Search Console, link previews, analytics,
and legacy resume redirects should all continue to behave cleanly.

## High-ROI Content Work

### 4. Expand One or Two Case Studies

Prioritize depth over adding more projects. Add fuller case studies with:

- problem
- constraints
- your role
- technical decisions
- measurable outcome
- what you would improve now

Why it matters: case studies communicate engineering judgment and ownership better than a longer project list.

### 5. Improve Card Information Hierarchy

Recruiters may not click every hidden detail panel. Consider showing 1-2 headline achievements on card fronts, then using details for the full story.

Important design note: the previous project-card "Impact" callout experiment looked misaligned and should not be reintroduced as-is. Revisit this more intentionally, likely starting with Experience cards or a compact, consistent headline-proof pattern.

Example front-card proof point for the current Home Depot role:

> HPA rollout: 40% lower latency, 89% fewer errors, 34.8M weekly requests.

### 6. Reorganize Dense Experience Bullets

The full-time Home Depot role has strong production proof, but the hidden card has a lot of bullets. Split them into clearer categories:

- Reliability & autoscaling
- Deployment/platform automation
- Security/platform hygiene
- Observability/incident response
- Data integrity/backend systems

Why it matters: the content is strong, but it needs easier scanning.

### 7. Polish Older Experience Wording

Replace awkward wording such as "pruning customer theft by ~$10 million annually."

Possible replacements:

- contributing to an estimated ~$10M annual shrink reduction opportunity
- supporting loss-prevention workflows tied to an estimated ~$10M annual shrink reduction

## Analytics And Conversion Work

### 8. Finish GA4 Key Event Cleanup

Mark only business-relevant events as GA4 key events.

Recommended key events:

- `project_source_click`
- `case_study_link_click`
- `contact_form_success` once it appears after a successful test submit
- `file_download` if GA is tracking the resume download through Enhanced Measurement instead of the custom `resume_download` event

Keep these as diagnostic events, not key events:

- `project_details_open`
- `case_study_card_click`
- `resume_open`
- generic `click`
- default GA events such as `page_view`, `scroll`, `session_start`, and `user_engagement`

### 9. Use Analytics To Guide Project UX

After events have data, check whether users:

- open project details
- click GitHub/source links
- click case-study links
- bounce before engaging

If details get low engagement, move the highest-value proof point to the front of the card instead of relying on the flip interaction.

## Accessibility And UX Polish

### 10. Bring ExperienceCard Up To ProjectCard Accessibility Quality

ProjectCard has stronger interaction polish. ExperienceCard should get similar behavior:

- reduced-motion support
- Escape-to-close
- focus movement when details open
- focus restoration when details close

Consider extracting a shared hook or reusable pattern only if it meaningfully reduces duplication.

### 11. Improve Navigation Semantics

Recommended changes:

- make the main Navbar render `<nav aria-label="Primary navigation">`
- change the homepage hero's inner navigation-like wrapper to a semantic `<header>` if it is functioning as page intro content

Why it matters: small accessibility cleanup that makes the document structure clearer.

### 12. Revisit Ownership Card Disclosure Behavior

The ownership cards currently rely on hover/focus reveal behavior. Consider a clearer disclosure pattern:

- explicit "Show details" button
- `aria-expanded`
- `aria-controls`
- copy that says "Focus or hover for details" if the current behavior remains

## SEO, Discovery, And AI-Readable Data

### 13. Improve Route-Specific SEO For SPA Pages

The dynamic SEO component updates metadata after React loads, but some crawlers and link-preview bots may only see the default `index.html` metadata for deep routes.

Options:

- add prerendering/static generation for important routes
- emit route-specific HTML shells at build time
- use a Netlify Edge Function only if it remains simple and maintainable

High-value routes:

- `/case-studies/kubernetes-autoscaling`
- `/case-studies/legacy-deployment-recovery`
- `/experience`
- `/projects`

### 14. Maintain AI-Readable Profile Data

The richer AI-readable profile work is already in motion through `llms.txt`, `ai-summary.txt`, and `/portfolio.json`. Keep this maintained as content changes.

Future enhancements:

- ensure projects, skills, case studies, links, and resume metadata stay current
- add validation if the JSON grows more complex
- avoid adding a database unless authenticated editing, comments, dynamic submissions, or multi-user content management become real requirements

## Technical Polish

### 15. Automate CSP JSON-LD Hash Maintenance

The inline JSON-LD hash in the CSP is brittle. If the JSON-LD changes and the hash is not updated, structured data can be blocked.

Possible fixes:

- add a build/test check that verifies the CSP hash
- generate CSP from the current JSON-LD
- move structured data generation into a more maintainable path if needed

### 16. Maintain Release Workflow Semantics

The release workflow now waits for Netlify's production deploy readback before creating a deployment release.

Keep this guardrail intact:

- require `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` GitHub secrets
- confirm the live Netlify production deploy is ready for the pushed commit
- smoke-check canonical metadata and the legacy resume redirect before release creation

### 17. Delete Stale Files

Review and likely delete unused `main/src/index.html` if Vite only uses `main/index.html`.

Why it matters: low-risk cleanup that reduces confusion.

### 18. Contact Form Autofill Polish

Add autocomplete attributes:

- `autoComplete="given-name"`
- `autoComplete="family-name"`
- `autoComplete="email"`

### 19. Performance And Image Pass

Optimize preview images and non-critical logos:

- explicit width/height where useful
- `loading="lazy"` for non-critical images
- `decoding="async"` where appropriate
- consider Netlify Image CDN later

This is useful but less urgent than homepage hierarchy and case-study depth.

## Optional Future Content

### 20. Add A Compact Now/Focus Section

Add a small current-focus section showing what you are actively focused on, such as:

- platform reliability
- Kubernetes
- observability
- incident response
- backend systems
- job-search interests

Why it matters: it makes the portfolio feel current without becoming a blog.

### 21. Lightweight Content Workflow

If projects and case studies will change often, consider moving more content into Markdown/MDX or structured JSON.

Do not add a database unless the site needs authenticated editing, comments, dynamic submissions, or multi-user content management.

## Suggested Sequencing

1. Fix the password wording and add the homepage metrics strip.
2. Add the custom domain.
3. Expand one or two case studies.
4. Improve Experience card scanability and accessibility.
5. Use GA4 data to decide whether project cards need a front-side proof-point redesign.
6. Address SPA SEO/prerendering once the content hierarchy is stronger.
7. Sweep remaining technical polish: stale files, autocomplete, image loading, CSP hash automation, and release naming.

## Current Judgment

The portfolio is already stronger than a typical early-career site. The next leap is information hierarchy: make the strongest engineering impact impossible to miss in the first five seconds, then use case studies and accessible interactions to support the deeper proof.
