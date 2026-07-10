import React, { useEffect, useId, useRef, useState } from "react";
import { FaArrowLeft, FaGithub, FaInfoCircle } from "react-icons/fa";
import { StackChips } from "./MissionControl.jsx";
import { trackEvent, trackLinkClick } from "../utils/analytics";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener?.(updatePreference);
    return () => mediaQuery.removeListener?.(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function ProjectCard({ id, title, techStack, bullets, github, logo }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const detailsButtonRef = useRef(null);
  const backButtonRef = useRef(null);
  const shouldRestoreDetailsFocusRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardId = useId();
  const detailsId = `${cardId}-details`;
  const stackItems = techStack.split(",").map((item) => item.trim());
  const cardTransform = prefersReducedMotion
    ? "none"
    : isFlipped
    ? "rotateY(180deg)"
    : "rotateY(0deg)";
  const frontTransform = prefersReducedMotion ? "none" : "rotateY(0deg)";
  const backTransform = prefersReducedMotion ? "none" : "rotateY(180deg)";
  const hiddenFaceDelay = prefersReducedMotion ? "0ms" : "250ms";
  const faceStyle = {
    WebkitBackfaceVisibility: "hidden",
    backfaceVisibility: "hidden",
    transitionProperty: "visibility",
    transitionDuration: "0s",
  };
  const frontFaceStyle = {
    ...faceStyle,
    WebkitTransform: frontTransform,
    transform: frontTransform,
    transitionDelay: isFlipped ? hiddenFaceDelay : "0ms",
    visibility: isFlipped ? "hidden" : "visible",
  };
  const backFaceStyle = {
    ...faceStyle,
    WebkitTransform: backTransform,
    transform: backTransform,
    transitionDelay: isFlipped ? "0ms" : hiddenFaceDelay,
    visibility: isFlipped ? "visible" : "hidden",
  };

  useEffect(() => {
    if (isFlipped) {
      backButtonRef.current?.focus();
      return;
    }

    if (shouldRestoreDetailsFocusRef.current) {
      shouldRestoreDetailsFocusRef.current = false;
      detailsButtonRef.current?.focus();
    }
  }, [isFlipped]);

  const showDetails = () => {
    trackEvent("project_details_open", {
      placement: "project_card",
      project_id: id,
      project_title: title,
    });
    setIsFlipped(true);
  };

  const hideDetails = () => {
    shouldRestoreDetailsFocusRef.current = true;
    setIsFlipped(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isFlipped) {
      event.stopPropagation();
      hideDetails();
    }
  };

  return (
    <article
      aria-label={`${title} project`}
      className="w-full min-h-[29rem] perspective"
      onKeyDown={handleKeyDown}
    >
      <div
        className="relative min-h-[29rem] w-full transform-style-preserve-3d transition-transform duration-500 will-change-transform motion-reduce:transition-none"
        style={{
          WebkitTransform: cardTransform,
          WebkitTransformStyle: "preserve-3d",
          transform: cardTransform,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden={isFlipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[#2563EB]/25 bg-[#111827] p-5 text-white shadow-[0_22px_60px_rgba(11,18,32,0.20)] backface-hidden ${
            isFlipped ? "pointer-events-none" : ""
          }`}
          style={frontFaceStyle}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-[#F96302]" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.20),transparent_18rem)]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
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
              className="inline-flex shrink-0 items-center rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white transition hover:border-[#F96302]/60 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#F96302] focus:ring-offset-2 focus:ring-offset-[#111827]"
            >
              <FaGithub className="mr-2" aria-hidden="true" />
              Source Code
            </a>
          </div>

          <StackChips items={stackItems} className="relative z-10 mt-4" />

          <div className="relative z-10 my-5 flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-[#E8EDF2] p-5">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="max-h-36 max-w-[78%] object-contain"
            />
          </div>

          <div className="relative z-10 mt-auto flex justify-end">
            <button
              ref={detailsButtonRef}
              type="button"
              onClick={showDetails}
              tabIndex={isFlipped ? -1 : 0}
              aria-label={`View details for ${title}`}
              aria-expanded={isFlipped}
              aria-controls={detailsId}
              className="mc-button-primary w-full sm:w-auto"
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
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-[#2563EB]/35 bg-[#0B1220] p-5 text-white shadow-[0_20px_70px_rgba(11,18,32,0.35)] backface-hidden rotate-y-180 ${
            isFlipped ? "" : "pointer-events-none"
          }`}
          style={backFaceStyle}
        >
          <p className="text-xs font-black uppercase text-[#93B4FF]">Technical notes</p>
          <h3 id={`${detailsId}-heading`} className="mt-2 text-xl font-black">
            {title} details
          </h3>
          <div className="mt-4 flex-grow overflow-y-auto pr-2">
            <ul className="space-y-3">
              {bullets.map((bullet, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#20A875]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            ref={backButtonRef}
            type="button"
            onClick={hideDetails}
            tabIndex={isFlipped ? 0 : -1}
            aria-label={`Hide details for ${title}`}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-[#2563EB] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#0B1220] sm:w-fit sm:py-2"
          >
            <FaArrowLeft className="mr-2" aria-hidden="true" />
            Back
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProjectCard;
