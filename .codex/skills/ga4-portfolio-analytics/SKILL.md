---
name: ga4-portfolio-analytics
description: GA4 analytics maintenance for Waffy Ahmed's personalWebsite portfolio. Use when Codex adds, removes, audits, documents, tests, or debugs Google Analytics events for resume actions, project/source clicks, project details, case-study navigation, social links, contact form activity, page views, or GA4 key-event recommendations.
---

# GA4 Portfolio Analytics

## Workflow

1. Keep event emission in `main/src/utils/analytics.js`, `main/src/hooks/usePageTracking.jsx`, and the components that own the user action.
2. Keep event tests in `main/src/App.test.jsx` close to the behavior being tracked.
3. Keep recommended GA4 key events in `docs/analytics.md` and `main/public/portfolio.json`.
4. Prefer these key-event candidates: `resume_download`, `contact_form_success`, `project_source_click`, and `case_study_link_click`.
5. Run the event consistency check:

```bash
node .codex/skills/ga4-portfolio-analytics/scripts/check_ga4_events.mjs /path/to/personalWebsite
```

Read [references/ga4-event-map.md](references/ga4-event-map.md) before changing event names or parameters.

## Rules

Do not mark diagnostic events as conversion/key events by default. Keep event names lowercase with underscores, include useful `placement` values, and avoid sending empty params.
