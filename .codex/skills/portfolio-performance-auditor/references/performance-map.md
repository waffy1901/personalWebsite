# Performance Map

Use this reference when performance, image behavior, lazy loading, or responsive rendering is the main risk.

## Route Loading

- Keep the default Home route eager so its hero image is discovered without an extra route-chunk request. Split secondary and catch-all routes with `React.lazy` and wrap them in `Suspense`.
- Keep the route fallback accessible with `role="status"` and `aria-live="polite"` so loading state is announced without becoming noisy.
- Check legacy uppercase redirects whenever changing route definitions; route performance changes should not break canonical routing.
- Keep route-level tests async when lazy-loaded pages render through `Suspense`.

## Image Policy

- Above-the-fold LCP candidates should be explicit:
  - Home profile image: read the 1024px hero-layout media query before its first render. At desktop width use `loading="eager"` and `fetchPriority="high"`; below that breakpoint use `loading="lazy"` and `fetchPriority="auto"` because the portrait follows the hero text. Subscribe to viewport changes, keep one picture/img, and preserve `decoding="async"` and reserved dimensions. Browser lazy loading may still request a nearby offscreen portrait.
  - Resume preview image: `loading="eager"`, `fetchPriority="high"`, `decoding="async"`.
- Repeated logos, project thumbnails, case-study images, and below-the-fold assets should use `loading="lazy"` and `decoding="async"`.
- Avoid adding remote image hosts without checking `netlify.toml` CSP image and connect allowlists.
- Prefer generated or existing bitmap assets for inspectable images; do not replace real portfolio imagery with decorative CSS/SVG placeholders.
- Run `npm run check:image-budgets` for the explicit source image inventory, file formats, dimensions, and byte ceilings. Resume WebP ceilings come from the existing resume variant manifest. See [image budgets](../../../../docs/image-budgets.md) for encodings and deliberate headroom.

## Layout And Runtime Checks

- Inspect changed routes at desktop width and around 390px mobile width when visual layout changed.
- Check for text overflow, clipped buttons, overlapping cards, horizontal scroll, and route fallback layout shift.
- Watch browser console output for failed chunks, missing assets, hydration/runtime errors, or blocked CSP requests.
- If testing production with a real browser, disclose possible GA4 traffic. Prefer local preview or non-browser HTTP checks when analytics side effects are not needed.

## Verification Menu

- Static policy check:

```bash
node .codex/skills/portfolio-performance-auditor/scripts/check_frontend_performance.mjs /Users/waffyahmed/Downloads/personalWebsite
```

- Checker regression test:

```bash
node --test .codex/skills/portfolio-performance-auditor/scripts/test_frontend_performance.mjs
```

- Focused tests:

```bash
npm run test
```

- Production build and bundle sanity:

```bash
npm run build
```

- Release-grade verification should hand off to `$portfolio-release-qa` after the focused performance checks pass.
