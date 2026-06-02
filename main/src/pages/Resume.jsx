import React from "react"
import { FaDownload, FaExternalLinkAlt } from "react-icons/fa"
import { resume } from "../data/profile"

function Resume() {
  return (
    <div className="min-h-[calc(100dvh-2.25rem)] bg-[#02A8DA] bg-opacity-25 px-3 py-4 font-cambria sm:p-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={resume.pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
          >
            <FaExternalLinkAlt className="mr-2" aria-hidden="true" />
            Open PDF
          </a>
          <a
            href={resume.pdf}
            download
            className="inline-flex items-center rounded bg-slate-800 px-4 py-2 font-bold text-white transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <FaDownload className="mr-2" aria-hidden="true" />
            Download Resume
          </a>
        </div>

        <a
          href={resume.pdf}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Waffy Ahmed resume PDF"
          className="mx-auto block w-full max-w-[900px] rounded border border-blue-200 bg-white p-1.5 shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 sm:p-2"
        >
          <img
            src={resume.preview}
            alt="Preview of Waffy Ahmed's resume"
            className="h-auto w-full rounded-sm"
          />
        </a>
      </div>
    </div>
  )
}
export default Resume
