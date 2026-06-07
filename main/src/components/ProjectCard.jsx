import React, { useEffect, useId, useRef, useState } from "react";
import { FaArrowLeft, FaGithub, FaInfoCircle } from "react-icons/fa";
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
      className="w-full min-h-[27rem] perspective"
      onKeyDown={handleKeyDown}
    >
      <div
        className="relative min-h-[27rem] w-full transform-style-preserve-3d transition-transform duration-500 will-change-transform motion-reduce:transition-none"
        style={{
          WebkitTransform: cardTransform,
          WebkitTransformStyle: "preserve-3d",
          transform: cardTransform,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden={isFlipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg bg-[#FFD700] bg-opacity-60 p-6 shadow-md backface-hidden ${
            isFlipped ? "pointer-events-none" : ""
          }`}
          style={frontFaceStyle}
        >
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
            className="absolute top-2 right-2 flex items-center text-gray-600 hover:text-gray-800 z-20"
          >
            <FaGithub className="mr-1" />
            <span>Source Code</span>
          </a>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex-shrink-0">
              <div className="flex items-center mb-4">
                <h2 className="text-2xl font-bold mr-2 mt-4">{title}</h2>
              </div>
              <p className="text-gray-600 font-bold mb-4">{techStack}</p>
            </div>
            <div className="flex flex-1 items-center justify-center py-5">
              <img
                src={logo}
                alt=""
                aria-hidden="true"
                className="max-h-40 max-w-[78%] object-contain"
              />
            </div>
          </div>
          <button
            ref={detailsButtonRef}
            type="button"
            onClick={showDetails}
            tabIndex={isFlipped ? -1 : 0}
            aria-label={`Show details for ${title}`}
            aria-expanded={isFlipped}
            aria-controls={detailsId}
            className="relative z-10 mt-auto inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaInfoCircle className="mr-2" />
            Details
          </button>
        </div>

        <div
          id={detailsId}
          role="region"
          aria-hidden={!isFlipped}
          aria-labelledby={`${detailsId}-heading`}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg bg-[#FFD700] bg-opacity-60 p-6 shadow-md backface-hidden rotate-y-180 ${
            isFlipped ? "" : "pointer-events-none"
          }`}
          style={backFaceStyle}
        >
          <h3 id={`${detailsId}-heading`} className="text-xl font-semibold mb-4">{title} details</h3>
          <div className="flex-grow max-h-full overflow-y-auto pr-2">
            <ul className="list-none pl-0 space-y-2">
              {bullets.map((bullet, index) => (
                <li key={index} className="text-gray-700 flex">
                  <span className="mr-2 flex-shrink-0">•</span>
                  <span className="flex-1">{bullet}</span>
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
            className="mt-4 inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </button>
        </div>
      </div>
    </article>
  );
}
export default ProjectCard;
