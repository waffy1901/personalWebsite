# WebKit smoke coverage

The WebKit smoke lane is a weekly and manually dispatched browser check of the production build served only from `http://127.0.0.1:4173`. It complements the required Chromium pre-merge suite. It does not run on pull requests and does not change the required Chromium check.

## Coverage contract

The shared smoke suite runs in fresh desktop `1440x1000` and mobile `390x844` WebKit contexts. It covers all nine canonical routes, horizontal overflow, hydrated navigation, history and focus behavior, the unknown-route experience, resume image loading and source selection, and the contact form's rendered state. Mobile keyboard navigation runs in the mobile project. Explicit resume density profiles run once per browser engine to avoid duplicate cases while retaining desktop and mobile source-selection coverage.

The keyboard assertions use ordinary `Tab` in Chromium and hosted Linux. Local macOS WebKit uses Playwright's `Alt+Tab` chord to exercise Safari's documented Option-Tab link traversal when macOS full keyboard access is disabled. The test records the selected shortcut as an annotation and keeps the same skip-link, logo, primary-link focus, focus-ring geometry, activation, and current-route assertions in every runtime. See [Safari keyboard shortcuts](https://help.apple.com/safari/mac/8.0/en.lproj/cpsh003.html) and [Playwright issue #41808](https://github.com/microsoft/playwright/issues/41808) for the platform behavior.

The local-only WebKit cases also exercise the resume download and contact behavior at both viewports. Native validation must prevent a provider request. The provider-error case intercepts the synthetic `synthetic-webkit-smoke-key` endpoint before navigation and returns a local field-plus-form error response. No message reaches Formspree.

The build clears `VITE_GA_MEASUREMENT_ID`, uses only the synthetic Formspree key, and installs route interception before page code runs. GA4, Google Tag Manager, DoubleClick, and every non-mocked Formspree request are fulfilled harmlessly or aborted. This proves local rendering and mocked event behavior; it does not prove delivery to analytics or Formspree.

## Runtime and evidence

The command uses the lockfile-resolved Playwright CLI and installs its matching WebKit runtime. Failed attempts retain a screenshot and trace. `main/webkit-results/current/report.md` and `report.json` record executed and skipped counts per project, skip reasons, runtime version, viewport, route, and retained failure attachments. The HTML report and raw Playwright test results live in the same directory. GitHub retains the complete directory for 14 days.

The numeric CLS assertion uses the Layout Instability API when the browser exposes `layout-shift` performance entries. Playwright WebKit currently does not expose that entry type, so the report records the assertion as unsupported while the source-selection, reserved-height, top-position, width, and overflow checks still run. Chromium continues to enforce the numeric CLS threshold.

## Commands

From the repository root, run:

```bash
npm run test:e2e:webkit
```

The command installs WebKit, builds with disabled analytics and the synthetic Formspree key, starts a strict local preview, and runs both projects. A configured `PLAYWRIGHT_PRODUCTION_BASE_URL` is rejected by the WebKit configuration.

For static workflow validation without a browser run:

```bash
npm run lint:workflows
```

Playwright WebKit is an engine-level compatibility signal. It is not evidence from Safari, iOS, macOS Safari, WebKitGTK, or a real mobile device. Hosted Ubuntu execution remains unverified until the workflow is published and runs on GitHub Actions.
