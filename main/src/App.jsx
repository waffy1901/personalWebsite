import React, {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react"
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router"
import Home from "./pages/Home.jsx"
import DeployDates from "./components/DeployDates.jsx"
import Navbar from "./components/Navbar.jsx"
import Seo from "./components/Seo.jsx"
import { deployInfo } from "./data/profile.js"
import usePageTracking from "./hooks/usePageTracking.jsx"

const Resume = lazy(() => import("./pages/Resume.jsx"))
const Contact = lazy(() => import("./pages/Contact.jsx"))
const CaseStudies = lazy(() => import("./pages/CaseStudies.jsx"))
const CaseStudy = lazy(() => import("./pages/CaseStudy.jsx"))
const Experience = lazy(() => import("./pages/Experience.jsx"))
const Projects = lazy(() => import("./pages/Projects.jsx"))
const NotFound = lazy(() => import("./pages/NotFound.jsx"))

function RouteLoadingFallback() {
  return (
    <div
      data-route-loading-fallback
      className="flex min-h-[18rem] items-center justify-center px-4 py-16"
    >
      <p
        role="status"
        aria-live="polite"
        className="rounded-md border border-slate-900/10 bg-white/70 px-4 py-2 text-sm font-bold text-slate-600 shadow-xs"
      >
        Loading page...
      </p>
    </div>
  )
}

export function DelayedRoutePendingIndicator({ pending }) {
  const [visible, setVisible] = React.useState(false)

  useEffect(() => {
    if (!pending) return undefined

    const timeoutId = window.setTimeout(() => setVisible(true), 250)
    return () => window.clearTimeout(timeoutId)
  }, [pending])

  if (!pending || !visible) return null

  return (
    <p
      data-route-transition-pending
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      Loading next page...
    </p>
  )
}

function RouteErrorFallback({ currentPath }) {
  const alertRef = useRef(null)

  useEffect(() => {
    alertRef.current?.focus()
  }, [])

  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4 py-12 sm:py-16">
      <section
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        aria-labelledby="route-error-heading"
        className="mc-panel relative w-full max-w-2xl overflow-hidden border-l-4 border-l-[#F96302] p-6 focus:outline-hidden focus:ring-2 focus:ring-[#F96302] focus:ring-offset-2 sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFB077] text-xl font-black text-[#0B1220]"
          >
            !
          </span>
          <div>
            <p className="mc-eyebrow">Route recovery {currentPath}</p>
            <h1
              id="route-error-heading"
              className="text-3xl font-black leading-tight text-[#0B1220] sm:text-4xl"
            >
              This page didn’t load.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              A network or download error interrupted this route. Try this page
              again, or return home.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={currentPath} className="mc-button-primary">
                Try this page again
              </a>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md border border-slate-500 bg-white px-4 py-2 text-sm font-black text-[#0B1220] transition hover:border-[#1D4ED8] hover:bg-[#E8EDF2] focus:outline-hidden focus:ring-2 focus:ring-[#1D4ED8] focus:ring-offset-2"
              >
                Return home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

class RouteErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function App() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [displayedRoute, setDisplayedRoute] = useState(() => ({
    location,
    navigationType,
  }))
  const displayedLocation = displayedRoute.location
  const routePending = location.key !== displayedLocation.key

  useEffect(() => {
    if (location.key === displayedLocation.key) return

    // Keep the router's URL and page-view semantics immediate, but update the
    // lazy route tree in a transition so its existing content stays visible.
    startTransition(() => {
      setDisplayedRoute({ location, navigationType })
    })
  }, [displayedLocation.key, location, navigationType])

  useEffect(() => {
    if (
      displayedRoute.navigationType !== "PUSH" &&
      displayedRoute.navigationType !== "REPLACE"
    ) {
      return
    }

    const scrollToTop = { top: 0, left: 0, behavior: "instant" }
    window.scrollTo(scrollToTop)
    document.getElementById("main-content")?.focus({ preventScroll: true })
  }, [displayedRoute])

  usePageTracking()

  const handleSkipToMain = (event) => {
    event.preventDefault()
    document.getElementById("main-content")?.focus()
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F4F1EA]">
      <Seo />
      <a
        href="#main-content"
        onClick={handleSkipToMain}
        className="sr-only z-[60] rounded-md bg-[#0B1220] px-4 py-2 text-sm font-black text-white shadow-lg focus:fixed focus:left-4 focus:top-4 focus:not-sr-only focus:outline-hidden focus:ring-2 focus:ring-[#F96302] focus:ring-offset-2 focus:ring-offset-[#F4F1EA]"
      >
        Skip to main content
      </a>
      <Navbar />
      <div className="flex-1 overflow-auto">
        <DelayedRoutePendingIndicator key={location.key} pending={routePending} />
        <RouteErrorBoundary
          resetKey={displayedLocation.pathname}
          fallback={<RouteErrorFallback currentPath={displayedLocation.pathname} />}
        >
          <Suspense fallback={<RouteLoadingFallback />}>
            <div data-route-ready={displayedLocation.pathname}>
              <Routes location={displayedLocation}>
              <Route caseSensitive path="/" element={<Home />} />
              <Route caseSensitive path="/resume" element={<Resume />} />
              <Route caseSensitive path="/contact" element={<Contact />} />
              <Route caseSensitive path="/case-studies" element={<CaseStudies />} />
              <Route caseSensitive path="/case-studies/:slug" element={<CaseStudy />} />
              <Route caseSensitive path="/experience" element={<Experience />} />
              <Route caseSensitive path="/projects" element={<Projects />} />
              <Route caseSensitive path="/Resume" element={<Navigate to="/resume/" replace />} />
              <Route caseSensitive path="/Contact" element={<Navigate to="/contact/" replace />} />
              <Route caseSensitive path="/CaseStudies" element={<Navigate to="/case-studies/" replace />} />
              <Route caseSensitive path="/Case-Studies" element={<Navigate to="/case-studies/" replace />} />
              <Route caseSensitive path="/Experience" element={<Navigate to="/experience/" replace />} />
              <Route caseSensitive path="/Projects" element={<Navigate to="/projects/" replace />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </Suspense>
        </RouteErrorBoundary>
      </div>
      <div className="bg-[#E8EDF2] px-3 py-4 sm:px-5">
        <div className="mx-auto w-full max-w-6xl">
          <DeployDates first={deployInfo.firstPublishedAt} />
        </div>
      </div>
    </div>
  )
}
export default App
