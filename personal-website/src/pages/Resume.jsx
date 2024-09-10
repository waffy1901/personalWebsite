import React from "react"
import { Worker, Viewer } from "@react-pdf-viewer/core"
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout"
import "@react-pdf-viewer/core/lib/styles/index.css"
import "@react-pdf-viewer/default-layout/lib/styles/index.css"

function Resume() {
  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  return (
    <div className="p-8">
      <div className="flex justify-center mb-4">
        <a
          href="/waffyAhmedResume.pdf"
          download
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors font-cambria"
        >
          Download PDF
        </a>
      </div>
      <div className="max-w-2xl mx-auto border border-gray-300">
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
          <Viewer
            fileUrl="/waffyAhmedResume.pdf"
            plugins={[defaultLayoutPluginInstance]}
          />
        </Worker>
      </div>
    </div>
  )
}

export default Resume