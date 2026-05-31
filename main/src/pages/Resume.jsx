import React from "react"
import { FaDownload, FaExternalLinkAlt } from "react-icons/fa"

const resumePdf = "/waffyAhmedResume.pdf"
const resumePreview = "/resume-preview.png"

function Resume() {
  return (
    <div className="min-h-screen bg-[#02A8DA] bg-opacity-25 p-4 font-cambria">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={resumePdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
          >
            <FaExternalLinkAlt className="mr-2" aria-hidden="true" />
            Open PDF
          </a>
          <a
            href={resumePdf}
            download
            className="inline-flex items-center rounded bg-slate-800 px-4 py-2 font-bold text-white transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <FaDownload className="mr-2" aria-hidden="true" />
            Download Resume
          </a>
        </div>

        <a
          href={resumePdf}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Waffy Ahmed resume PDF"
          className="block flex-1 rounded border border-blue-200 bg-white p-2 shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
        >
          <img
            src={resumePreview}
            alt="Preview of Waffy Ahmed's resume"
            className="mx-auto h-auto w-full max-w-[900px] rounded-sm"
          />
        </a>
      </div>
    </div>
  )
}
export default Resume
