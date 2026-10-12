# Issue #265: Homepage access to engineering evidence

This records the completed local implementation and Chromium lab capture for
issue #265 on 2026-10-12.
The baseline is the refreshed `main` commit
`cd3f9cad35bcc6ba60e210f682cee39e941e07c5`. The revised measurements use the
uncommitted patch on `feat/issue-265-homepage-evidence`, based on that same
commit. These observations do not establish production behavior, field Core
Web Vitals, or a conversion improvement. The issue remains open.

## Implementation

- Removed the homepage hero's viewport minimum height and reduced spacing
  without reducing existing font sizes.
- Moved the existing resume and contact actions before the two current-role
  highlights. Both owner-approved highlights remain visible.
- Added a direct link to the existing Kubernetes autoscaling case, labeled
  with its existing 40% lower latency outcome. The canonical slug comes from
  `caseStudySeo.js`; focus, pointer, and press intent use the existing route
  prefetch handlers. The eager homepage does not import the full case-study
  data module.
- Reduced the portrait's rendered height to 256px on mobile, 320px at the
  intermediate breakpoint, and 416px on desktop. Updated `sizes` to match
  the narrower rendered widths while preserving intrinsic dimensions and
  eager/high/async image policy. Image-priority tuning remains owned by #172.
- Replaced inspection-oriented headings with engineering content in canonical
  `main/src/data/home.js`. Added wrapping to the new proof link and replacement
  headings, plus scroll clearance for the proof link beneath the sticky header.

No dependencies, hooks, analytics events, routes, or production configuration
changed. Generated public artifacts were regenerated and were already current.
The unrelated `scripts/__pycache__/` directory was preserved.

## Geometry comparison

Measurements are CSS pixels, with y coordinates relative to the document.
The normal-text runs use a 16px root font size and DPR 1.

| Viewport | Element | Baseline | Revised |
| --- | --- | --- | --- |
| 390 x 844 | Hero height | 1585.5 | 1351 |
| 390 x 844 | Portrait height / width | 480 / 274 | 256 / 206 |
| 390 x 844 | Resume action y | 841.5 | 597 |
| 390 x 844 | Contact action y | 889.5 | 645 |
| 390 x 844 | Early Kubernetes link y range | Absent | 699 to 744.5 |
| 390 x 844 | Impact metrics y | 1742.5 | 1508 |
| 390 x 844 | Lower featured case CTA y | 3476 | 3241.5 |
| 1440 x 1000 | Hero height | 1106 | 853.25 |
| 1440 x 1000 | Portrait height / width | 480 / 430 | 416 / 334 |
| 1440 x 1000 | Resume / contact action y | 824.875 | 480.5 |
| 1440 x 1000 | Early Kubernetes link y range | Absent | 534.5 to 557.25 |
| 1440 x 1000 | Impact metrics y | 1219 | 966.25 |
| 320 x 844 | Early Kubernetes link y range | Absent | 781 to 826.5 |

At 390px, the first screen now contains both resume/contact actions and the
direct Kubernetes proof link. The second screen contains the retained role
outcomes, portrait, and beginning of the metrics section. The baseline's resume
action began near the first-screen boundary and its contact action fell below
it; its portrait and metrics also appeared later. At 1440px, the revised hero
ends at y918.25, fitting within the first screen, with the proof link and actions
visible before scrolling. The homepage still retains the longer featured case
section below; the new early link provides a shorter path to the same case.

## Browser checks

The coordinator used local production previews in Chromium 153.0.8010.12,
blocking GA, GTM, Formspree, and external hosts. The baseline and revised runs
recorded no external requests or page errors. Evidence artifacts are local to
`/private/tmp/issue265-1doda0o6/evidence` and are not production records.
The final records are `final-geometry.json` and `final-browser-qa.json`, with
first/second-screen PNGs and `final-small-200-keyboard-visible.png`.
`enlarged-text-comparison.json` records baseline/revised reflow observations;
its earlier focus observation is superseded by `final-browser-qa.json`.

- Keyboard navigation reached skip link, brand, primary navigation, resume,
  contact, and the early proof link. The proof link showed a visible orange
  focus ring; Enter opened the correct case-study heading. Contact navigation
  reached the local form heading. The local resume endpoint returned HTTP 200,
  `application/pdf`, and a `%PDF-` signature.
  The final 320px / 200% text keyboard run confirmed that, after smooth scrolling
  settled, the proof link was fully visible at viewport y455 to y773.5 below
  the sticky header's y329 bottom edge. Its computed scroll margin was 384px
  (12rem at the 32px root size); Enter reached the correct case heading.
- Reduced motion disabled hero animation and transforms; the early proof link
  retained its normal mobile position.
- DPR 2 selected a 450 x 600 WebP for the mobile portrait rendered at 206 x
  256, and a 675 x 900 WebP for desktop rendered at 334 x 416. Visual inspection
  found the portrait sharp at both sizes. These candidates were inspected for
  portrait sharpness; image priority was unchanged here.
- Axe reported 35 passing checks and no serious or critical violations. The
  existing moderate `landmark-unique` advisory remains unsuppressed.
- The final sampled home -> projects -> experience -> case-studies -> resume ->
  contact -> home navigation observed zero layout shifts. This is a local
  sampled navigation result, not a field CLS claim.
- Text scaling used a 32px root font size (200% text), not browser zoom. The
  existing mobile h1 and tagline scales remained 96px and 48px respectively. New
  link and replacement-heading text wrap without reducing font sizes.

The unchanged featured heading still has text overflow under the 320px and
390px 200% text probes (432px scroll width against 256px and 326px client widths,
respectively), matching the baseline. The unchanged resume button's overflow
at 320px / 200% decreased from 14px to 6px but remains. These existing limits
are retained as limitations rather than claimed as resolved by this patch.

## Source checks and boundaries

Application checks ran in an isolated clean install with Node 22.22.3:

- `npm run lint`: passed.
- `npm run test`: all 79 Vitest, 45 Node, and 10 Python tests passed.
- `npm run build`: passed, including nine metadata routes.

Static validators ran in the working checkout under pinned Node 22.22.3;
`git diff --check` also ran in that checkout:

- `node .codex/skills/portfolio-change-impact/scripts/check_change_impact.mjs
  --source worktree --check`: generated freshness, content sync, AI discovery,
  GA4 contract, and frontend performance policy all passed.
- `npm run generate:public` and `npm run generate:public -- --check`: artifacts
  remained current.
- `git diff --check`: passed.

The new unit coverage exercises the early link's destination, focus prefetch,
and navigation to the case heading. Existing image priority, intrinsic-size,
and role-highlight coverage remains in place. Eager JavaScript measured
298.48kB / 95.20kB gzip, versus 297.87kB / 95.07kB gzip for the baseline.

Safari/iOS, manual assistive technology, a blinded human task study, field
metrics, provider delivery, and production serving state were not verified.
This local evidence does not close issue acceptance criteria. At this local
capture, publication and independent PR review had not occurred because the
active grant permitted local implementation only. No commit, push, PR, merge,
deployment, release, provider mutation, issue closure, or acceptance closure
occurred during this capture. Later publication and review are tracked
separately.
