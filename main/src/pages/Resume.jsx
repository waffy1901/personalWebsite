import React from "react"
import { Worker, Viewer } from "@react-pdf-viewer/core"
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout"
import "@react-pdf-viewer/core/lib/styles/index.css"
import "@react-pdf-viewer/default-layout/lib/styles/index.css"
import { FaDownload } from "react-icons/fa"

function Resume() {
  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  return (
    <div className="flex flex-col min-h-screen bg-[#02A8DA] bg-opacity-25">
      <div className="flex justify-center p-6">
        <a
          href="/waffyAhmedResume.pdf"
          download
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors font-cambria inline-flex items-center"
        >
          <FaDownload className="mr-2" />
          Download PDF
        </a>
      </div>
      <div className="flex-grow max-w-2xl mx-auto w-full bg-[#02A8DA] bg-opacity-25">
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
          <Viewer
            fileUrl="/waffyAhmedResume.pdf"
            plugins={[defaultLayoutPluginInstance]}
            theme={{
              viewer: {
                background: "rgba(2, 168, 218, 0.25)",
              },
            }}
          />
        </Worker>
      </div>
    </div>
  )
}
export default Resume