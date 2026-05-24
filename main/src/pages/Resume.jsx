import React from "react"

function Resume() {
  return (
    <div className="min-h-screen bg-[#02A8DA] bg-opacity-25 p-4 font-cambria">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/waffyAhmedResume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700"
          >
            Open PDF
          </a>
          <a
            href="/waffyAhmedResume.pdf"
            download
            className="rounded bg-slate-800 px-4 py-2 font-bold text-white transition-colors hover:bg-slate-900"
          >
            Download Resume
          </a>
        </div>

        <object
          data="/waffyAhmedResume.pdf"
          type="application/pdf"
          aria-label="Waffy Ahmed resume PDF"
          className="min-h-[75vh] flex-1 rounded border border-blue-200 bg-white shadow-lg"
        >
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-white p-6 text-center text-gray-700">
            <p>Your browser cannot display this PDF inline.</p>
            <a
              href="/waffyAhmedResume.pdf"
              className="font-bold text-blue-700 underline"
            >
              Open the resume PDF
            </a>
          </div>
        </object>
      </div>
    </div>
  )
}
export default Resume
