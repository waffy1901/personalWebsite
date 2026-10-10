# Accessibility Regression Scanning

The required **Pre-merge browser smoke** check runs Axe against the local
production-equivalent preview in desktop Chromium at 1440x1000 and mobile
Chromium at 390x844. The scanner blocks the check when Axe reports a `critical`
or `serious` violation. `moderate`, `minor`, and unclassified violations remain
advisory and are listed in Playwright annotations and attached JSON evidence.

The suite runs Axe's complete default rule set. That keeps WCAG rules together
with default semantic, landmark, ARIA, color-contrast, and best-practice rules.
It does not disable rules, exclude page regions, or maintain a violation
allowlist. A future exclusion must be limited to the smallest affected selector,
explain why the rule cannot be fixed immediately, and link to a durable tracked
issue with an owner and removal condition.

## Commands and CI integration

Run only the accessibility suite from the repository root:

```bash
npm run test:e2e:a11y
```

Run the complete required local browser gate:

```bash
npm run test:e2e:premerge
```

Both commands build with the non-secret
`VITE_FORMSPREE_KEY=synthetic-premerge-test-key`, set
`PLAYWRIGHT_LOCAL_PREVIEW=1`, and serve the production build on
`http://127.0.0.1:4173`. The accessibility spec rejects any other mode or base
URL. The production browser command continues to run only the existing smoke
spec and never loads the accessibility state tests.

The suite contains 14 tests per browser profile. It performs 19 Axe scans per
profile: nine default canonical-route scans, seven dynamic-state scans, and
three negative-control scans. The GitHub job keeps its existing 15-minute
timeout, single worker, and one CI retry. The build is shared with the existing
browser smoke cases, so the required gate still builds and starts the preview
once.

## Route and state coverage

Canonical coverage is generated at test discovery from
`src/data/seo.js` `routeMetadata[].canonicalPath`. Adding a canonical route to
that source automatically adds desktop and mobile scans after the route signals
its matching `data-route-ready` value, renders one visible `h1`, finishes page
load, settles document fonts, and finishes any currently running finite CSS or
Web Animations. Infinite decorative animations are left running, and the suite
does not use fixed sleeps or disable motion globally.

| Route source or path | State | Desktop | Mobile |
| --- | --- | --- | --- |
| Every `routeMetadata[].canonicalPath` (currently 9 routes) | Default rendered page | Blocking | Blocking |
| `/projects/` | Every project detail card expanded together | Blocking | Blocking |
| `/experience/` | Featured role details and every expandable accomplishment list open | Blocking | Blocking |
| `/contact/` | Native invalid email and short-message constraints | Blocking | Blocking |
| `/contact/` | Mocked provider field error | Blocking | Blocking |
| `/contact/` | Mocked general/service error | Blocking | Blocking |
| `/contact/` | Mocked combined field/general error with email recovery link | Blocking | Blocking |
| `/contact/` | Mocked successful submission and focused status | Blocking | Blocking |
| `/` | Permanent serious-rule negative control and recovery | Test of the gate | Test of the gate |

The expanded-card cases reach their controls through keyboard traversal. When
an expanded details panel actually overflows, the test focuses its named scroll
region, verifies `ArrowDown` changes the scroll position, closes the card with
Escape, confirms focus returns to the details control, and reopens the card
before the Axe scan.

The negative control first proves the real page passes, injects a visible link
without an accessible name, and verifies Axe's serious `link-name` result trips
the production assertion. It checks that the failure identifies the route,
state, rule, impact, affected node, remediation summary, and Axe help URL. The
test then removes the injected node and proves the page passes again. No
application-only injection switch or scanner bypass is shipped.

## Telemetry and form safety

The accessibility suite reuses `e2e/support/telemetry-safe-test.js` before every
navigation. Fresh browser contexts replace `gtag`, intercept Google Analytics,
Google Tag Manager, and DoubleClick hosts, and block real Formspree requests.
Contact state tests register a narrower page mock before navigation, fulfill
synthetic POSTs entirely inside Playwright, assert the expected synthetic URL
and body, and confirm that no request reached the fixture's real-Formspree
guard. These tests prove client behavior against controlled responses; they do
not prove provider receipt or delivery.

## Failure output

A blocking failure is printed inline in this shape:

```text
Accessibility scan failed: route=/contact/ state=provider-field-error
  rule=example-rule impact=serious
    help: Example rule help
    remediation URL: https://dequeuniversity.com/rules/axe/...
    affected node 1: ["#example"]
      html: <input id="example">
      remediation: Fix any of the following: ...
```

When Axe reports any violation, the test also attaches structured JSON for the
route and state to Playwright's failure evidence.

## Evidence limits

Automated Axe checks detect only issues represented by their rules and the
rendered states above. They are not WCAG certification and do not replace the
existing keyboard and focus tests, reduced-motion behavior, responsive layout
and overflow checks, console/network monitoring, WebKit compatibility lane, or
manual assistive-technology review. The required gate uses Playwright Chromium;
it does not represent real Safari, iOS, screen-reader, or provider-delivery
evidence.
