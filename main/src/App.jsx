import React, { Suspense, lazy } from "react"
import { Navigate, Routes, Route } from "react-router-dom"
import Home from "./pages/Home.jsx"
import Navbar from "./components/Navbar.jsx"
import Seo from "./components/Seo.jsx"
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
    <div className="flex min-h-[18rem] items-center justify-center px-4 py-16">
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

function App() {
  usePageTracking()
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F4F1EA]">
      <Seo />
      <Navbar />
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route caseSensitive path="/" element={<Home />} />
            <Route caseSensitive path="/resume" element={<Resume />} />
            <Route caseSensitive path="/contact" element={<Contact />} />
            <Route caseSensitive path="/case-studies" element={<CaseStudies />} />
            <Route caseSensitive path="/case-studies/:slug" element={<CaseStudy />} />
            <Route caseSensitive path="/experience" element={<Experience />} />
            <Route caseSensitive path="/projects" element={<Projects />} />
            <Route caseSensitive path="/Resume" element={<Navigate to="/resume" replace />} />
            <Route caseSensitive path="/Contact" element={<Navigate to="/contact" replace />} />
            <Route caseSensitive path="/CaseStudies" element={<Navigate to="/case-studies" replace />} />
            <Route caseSensitive path="/Case-Studies" element={<Navigate to="/case-studies" replace />} />
            <Route caseSensitive path="/Experience" element={<Navigate to="/experience" replace />} />
            <Route caseSensitive path="/Projects" element={<Navigate to="/projects" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
export default App
