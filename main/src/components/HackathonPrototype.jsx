import React, { lazy, Suspense } from "react";
import { StatusBadge } from "./MissionControl.jsx";
import ProjectLinkCopy from "./ProjectLinkCopy.jsx";
import { trackEvent } from "../utils/analytics";

const HackathonPrototypeDetails = lazy(() => import("./HackathonPrototypeDetails.jsx"));

export default function HackathonPrototype({ project, isOpen, onSelect }) {
  const handleToggle = (event) => {
    event.preventDefault();
    if (isOpen) {
      onSelect(null);
      return;
    }

    trackEvent("project_details_open", {
      placement: "project_card",
      project_id: project.id,
      project_title: project.title,
    });
    onSelect(project.id);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      onSelect(null);
    }
  };

  return (
    <article
      id={project.id}
      aria-labelledby={`${project.id}-heading`}
      className="mc-panel min-w-0 scroll-mt-56 p-5 [overflow-wrap:anywhere] sm:p-7"
      onKeyDown={handleKeyDown}
    >
      <StatusBadge tone="orange">{project.status}</StatusBadge>
      <p className="mt-4 text-sm font-bold text-slate-600">{project.timeframe}</p>
      <h2
        id={`${project.id}-heading`}
        data-focus={isOpen ? "" : undefined}
        tabIndex={isOpen ? -1 : undefined}
        className="mt-3 text-3xl font-black text-[#0B1220]"
      >
        {project.title}
      </h2>
      <p className="mt-4 leading-relaxed text-slate-600">{project.summary}</p>
      <p className="mt-4 font-bold leading-relaxed text-slate-800">{project.outcome}</p>
      <p className="mt-4 border-l-4 border-[#F96302] pl-4 leading-relaxed text-slate-700">{project.reviewBoundary}</p>
      <details open={isOpen} className="mt-6 border-t border-slate-200 pt-5">
        <summary
          data-focus={isOpen ? undefined : ""}
          onClick={handleToggle}
          className="cursor-pointer rounded-sm font-black text-[#1D4ED8] underline underline-offset-4 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
        >
          Delivery flow, ownership, and limitations
        </summary>
        {isOpen ? (
          <>
            <div className="mt-4">
              <ProjectLinkCopy id={project.id} title={project.title} />
            </div>
            <Suspense fallback={<p role="status" className="mt-6 text-sm text-slate-600">Loading prototype details...</p>}>
              <HackathonPrototypeDetails />
            </Suspense>
          </>
        ) : null}
      </details>
    </article>
  );
}
