import React from "react";
import { FaDownload, FaExternalLinkAlt } from "react-icons/fa";
import {
  PageContainer,
  PageShell,
  SectionHeader,
} from "../components/MissionControl.jsx";
import { resume } from "../data/profile";
import { trackEvent } from "../utils/analytics";

function Resume() {
  return (
    <PageShell>
      <PageContainer className="max-w-5xl">
        <SectionHeader
          eyebrow="Resume artifact"
          title="Resume"
          description="A focused snapshot of platform reliability, production ownership, deployment automation, and full-stack project work."
          align="center"
        />

        <section className="mc-panel p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-wrap justify-center gap-3 sm:justify-end">
              <a
                href={resume.pdf}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("resume_open", {
                    placement: "resume_actions",
                  })
                }
                className="mc-button-light"
              >
                <FaExternalLinkAlt className="mr-2" aria-hidden="true" />
                Open PDF
              </a>
              <a
                href={resume.pdf}
                download
                onClick={() =>
                  trackEvent("resume_download", {
                    placement: "resume_actions",
                  })
                }
                className="mc-button-primary"
              >
                <FaDownload className="mr-2" aria-hidden="true" />
                Download Resume
              </a>
            </div>
          </div>

          <a
            href={resume.pdf}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Waffy Ahmed resume PDF"
            onClick={() =>
              trackEvent("resume_open", {
                placement: "resume_preview",
              })
            }
            className="mx-auto block w-full max-w-[900px] rounded-lg border border-slate-200 bg-[#E8EDF2] p-2 shadow-inner transition hover:border-[#2563EB]/50 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
          >
            <img
              src={resume.preview}
              alt="Preview of Waffy Ahmed's resume"
              className="h-auto w-full rounded-md"
            />
          </a>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default Resume;
