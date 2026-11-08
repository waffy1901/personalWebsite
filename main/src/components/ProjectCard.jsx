import React, { useId } from "react";
import { FaArrowLeft, FaGithub, FaInfoCircle } from "react-icons/fa";
import { StackChips } from "./MissionControl.jsx";
import ProjectLinkCopy from "./ProjectLinkCopy.jsx";
import { trackEvent, trackLinkClick } from "../utils/analytics";

function ProjectCard({
  id,
  title,
  techStack,
  summary,
  outcome,
  bullets,
  github,
  logo,
  logoWebp,
  logoWidth,
  logoHeight,
  isFlipped,
  onSelect,
}) {
  const cardId = useId();
  const detailsId = `${cardId}-details`;
  const stackItems = techStack.split(",").map((item) => item.trim());

  const showDetails = () => {
    trackEvent("project_details_open", {
      placement: "project_card",
      project_id: id,
      project_title: title,
    });
    onSelect(id);
  };

  const hideDetails = () => {
    onSelect(null);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isFlipped) {
      event.stopPropagation();
      hideDetails();
    }
  };

  return (
    <article
      id={id}
      aria-label={`${title} project`}
      className="w-full min-w-0 scroll-mt-36 mc-perspective"
      onKeyDown={handleKeyDown}
    >
      <div className="mc-project-flip relative w-full" data-flipped={isFlipped}>
        <div
          aria-hidden={isFlipped}
          className={`${isFlipped ? "absolute inset-0" : "relative"} flex min-h-[29rem] flex-col overflow-hidden rounded-2xl border border-[#2563EB]/25 bg-[#111827] p-5 text-white shadow-[0_22px_60px_rgba(11,18,32,0.20)]`}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-[#F96302]" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.20),transparent_18rem)]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFB077]">
                Build record
              </p>
              <h2 className="mt-2 break-words text-2xl font-black leading-tight text-white">
                {title}
              </h2>
            </div>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={isFlipped ? -1 : 0}
              onClick={() =>
                trackLinkClick("project_source_click", {
                  href: github,
                  label: "Source Code",
                  placement: "project_card",
                  project_id: id,
                  project_title: title,
                })
              }
              className="inline-flex max-w-full items-center rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:border-[#F96302]/60 hover:bg-white/15 focus:outline-hidden focus:ring-2 focus:ring-[#F96302] focus:ring-offset-2 focus:ring-offset-[#111827]"
            >
              <FaGithub className="mr-2" aria-hidden="true" />
              Source Code
            </a>
          </div>

          <p className="relative z-10 mt-5 min-w-0 break-words text-sm leading-relaxed text-slate-200">{summary}</p>
          <p className="relative z-10 mt-3 min-w-0 break-words text-sm font-bold leading-relaxed text-[#FFB077]">{outcome}</p>

          <StackChips items={stackItems} className="relative z-10 mt-4" />

          <div className="relative z-10 my-5 flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-[#E8EDF2] p-5">
            <picture>
              <source srcSet={logoWebp} type="image/webp" />
              <img
                src={logo}
                width={logoWidth}
                height={logoHeight}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="max-h-36 max-w-[78%] object-contain"
              />
            </picture>
          </div>

          <div className="relative z-10 mt-auto flex justify-end">
            <button
              type="button"
              onClick={showDetails}
              data-project-toggle={isFlipped ? undefined : ""}
              tabIndex={isFlipped ? -1 : 0}
              aria-label={`View details for ${title}`}
              aria-expanded={isFlipped}
              aria-controls={detailsId}
              className="mc-button-primary w-full scroll-mt-36 sm:w-auto"
            >
              <FaInfoCircle className="mr-2" aria-hidden="true" />
              View details
            </button>
          </div>
        </div>

        <div
          id={detailsId}
          role="region"
          aria-hidden={!isFlipped}
          aria-labelledby={`${detailsId}-heading`}
          className={`${isFlipped ? "relative" : "absolute inset-0"} mc-project-back mc-panel-dark flex flex-col overflow-hidden border-[#2563EB]/35 p-5`}
        >
          <p className="text-xs font-black uppercase text-[#93B4FF]">Technical notes</p>
          <h3 id={`${detailsId}-heading`} className="mt-2 break-words text-xl font-black">
            {title} details
          </h3>
          <div
            role="group"
            aria-label={`${title} technical details`}
            tabIndex={isFlipped ? 0 : -1}
            className="mt-4 max-h-64 overflow-y-auto pr-2 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#0B1220]"
          >
            <ul className="space-y-3">
              {bullets.map((bullet, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#20A875]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-slate-400">Scroll for all technical notes.</p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={hideDetails}
              data-project-toggle={isFlipped ? "" : undefined}
              tabIndex={isFlipped ? 0 : -1}
              aria-label={`Back to summary for ${title}`}
              className="mc-button-secondary scroll-mt-36 py-3 sm:py-2"
            >
              <FaArrowLeft className="mr-2" aria-hidden="true" />
              Back
            </button>
            {isFlipped ? <ProjectLinkCopy id={id} title={title} /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default ProjectCard;
