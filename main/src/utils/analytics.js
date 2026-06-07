export const ANALYTICS_SCRIPT_ID = "google-analytics-script"

const getMeasurementId = () =>
  import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

const getLinkDomain = (url) => {
  try {
    return new URL(url, window.location.origin).hostname
  } catch {
    return undefined
  }
}

const compactEventParams = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  )

export function ensureGtag() {
  if (typeof window === "undefined") {
    return null
  }

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments)
    }

  return window.gtag
}

export function initializeAnalytics(measurementId = getMeasurementId()) {
  if (!measurementId || typeof document === "undefined") {
    return false
  }

  const gtag = ensureGtag()

  if (!document.getElementById(ANALYTICS_SCRIPT_ID)) {
    const script = document.createElement("script")
    script.id = ANALYTICS_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId
    )}`
    document.head.appendChild(script)
  }

  if (window.__portfolioGaInitialized !== measurementId) {
    gtag("js", new Date())
    gtag("config", measurementId, { send_page_view: false })
    window.__portfolioGaInitialized = measurementId
  }

  return true
}

export function trackEvent(eventName, eventParams = {}) {
  const measurementId = getMeasurementId()

  if (!measurementId) {
    return false
  }

  const gtag = ensureGtag()
  if (!gtag) {
    return false
  }

  gtag(
    "event",
    eventName,
    compactEventParams({
      send_to: measurementId,
      ...eventParams,
    })
  )

  return true
}

export function trackLinkClick(eventName, { href, label, placement, ...params }) {
  return trackEvent(eventName, {
    link_domain: href ? getLinkDomain(href) : undefined,
    link_text: label,
    link_url: href,
    placement,
    ...params,
  })
}
