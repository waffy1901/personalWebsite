const routeImporters = new Map([
  ["/resume", () => import("../pages/Resume.jsx")],
  ["/contact", () => import("../pages/Contact.jsx")],
  ["/case-studies", () => import("../pages/CaseStudies.jsx")],
  ["/experience", () => import("../pages/Experience.jsx")],
  ["/projects", () => import("../pages/Projects.jsx")],
])

const caseStudyImporter = () => import("../pages/CaseStudy.jsx")
const routePromises = new Map()

const normalizePath = (pathname) => {
  const path = String(pathname || "").split(/[?#]/, 1)[0]
  return path.replace(/\/+$/, "") || "/"
}

const importerForPath = (pathname) => {
  const path = normalizePath(pathname)

  if (path.startsWith("/case-studies/")) {
    return caseStudyImporter
  }

  return routeImporters.get(path)
}

const loadRoute = (importer) => {
  const existingPromise = routePromises.get(importer)

  if (existingPromise) {
    return existingPromise
  }

  const routePromise = importer()
  routePromises.set(importer, routePromise)
  routePromise.catch(() => {
    if (routePromises.get(importer) === routePromise) {
      routePromises.delete(importer)
    }
  })

  return routePromise
}

export function preloadRoute(pathname) {
  const importer = importerForPath(pathname)
  return importer ? loadRoute(importer) : null
}

// Keep preloading tied to a concrete navigation signal. This deliberately has
// no idle, viewport, or mount-time invocation path.
export function createRouteIntentHandlers(pathname) {
  const preload = () => void preloadRoute(pathname)

  return {
    onPointerEnter: preload,
    onPointerDown: preload,
    onFocus: preload,
  }
}
