import { Navigate, Routes, Route } from "react-router-dom"
import Home from "./pages/Home.jsx"
import Resume from "./pages/Resume.jsx"
import Contact from "./pages/Contact.jsx"
import CaseStudies from "./pages/CaseStudies.jsx"
import CaseStudy from "./pages/CaseStudy.jsx"
import Experience from "./pages/Experience.jsx"
import Projects from "./pages/Projects.jsx"
import NotFound from "./pages/NotFound.jsx"
import Navbar from "./components/Navbar.jsx"
import Seo from "./components/Seo.jsx"
import React from "react"
import usePageTracking from "./hooks/usePageTracking.jsx"

function App() {
  usePageTracking()
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Seo />
      <Navbar />
      <div className="flex-1 overflow-auto bg-slate-100">
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
      </div>
    </div>
  )
}
export default App
