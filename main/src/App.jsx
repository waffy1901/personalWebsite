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
import React from "react"
import usePageTracking from "./hooks/usePageTracking.jsx"

function App() {
  usePageTracking()
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Navbar />
      <div className="flex-1 overflow-auto bg-slate-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/case-studies/:slug" element={<CaseStudy />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/Resume" element={<Navigate to="/resume" replace />} />
          <Route path="/Contact" element={<Navigate to="/contact" replace />} />
          <Route path="/CaseStudies" element={<Navigate to="/case-studies" replace />} />
          <Route path="/Case-Studies" element={<Navigate to="/case-studies" replace />} />
          <Route path="/Experience" element={<Navigate to="/experience" replace />} />
          <Route path="/Projects" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}
export default App
