import React, { useEffect, useId, useRef, useState } from "react";
import { FaArrowLeft, FaCheck, FaClipboard, FaInfoCircle } from "react-icons/fa";
import { StatusBadge } from "./MissionControl.jsx";

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

const ExperienceCard = ({
  title,
  company,
  location,
  date,
  bullets,
  logo,
  featured = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);
  const detailsButtonRef = useRef(null);
  const backButtonRef = useRef(null);
  const copyResetTimeoutRef = useRef(null);
  const shouldRestoreDetailsFocusRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardId = useId();
  const titleId = `${cardId}-title`;
  const detailsId = `${cardId}-details`;
  const isHomeDepot = company === "The Home Depot";
  const useStandaloneLogo = featured && isHomeDepot;
  const accentClass = isHomeDepot ? "bg-[#F96302]" : "bg-[#2563EB]";
  const accentTextClass = isHomeDepot ? "text-[#FFB077]" : "text-[#93B4FF]";
  const frontFaceClass = featured
    ? "border-white/10 bg-[#111827]"
    : "border-white/10 bg-white/[0.065]";
  const logoTileClass = useStandaloneLogo
    ? ""
    : isHomeDepot
    ? "border-[#F96302]/35 bg-[#F96302]"
    : "border-[#2563EB]/35 bg-[#2563EB]";
  const cardHeightClass = featured
    ? "min-h-[30rem] lg:min-h-[36rem]"
    : "min-h-[24rem]";
  const logoBayClass = useStandaloneLogo
    ? "my-5 flex flex-1 items-start justify-center pt-4 lg:pt-6"
    : featured
    ? "my-5 flex flex-1 items-start justify-center rounded-2xl border p-8 pt-10"
    : "my-5 flex flex-1 items-center justify-center rounded-2xl border p-6";
  const logoImageClass = useStandaloneLogo
    ? "h-44 w-44 object-contain sm:h-52 sm:w-52"
    : featured
    ? "max-h-52 max-w-[82%] object-contain shadow-[0_18px_42px_rgba(11,18,32,0.28)]"
    : "max-h-32 max-w-[70%] object-contain";
  const detailsButtonClass = "mc-button-primary w-full sm:w-auto";
  const copyStatusMessage =
    copyStatus === "success"
      ? `${title} details copied.`
      : copyStatus === "error"
      ? `${title} details could not be copied.`
      : "";
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
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

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

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(bullets.join("\n"));
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    } finally {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus(null);
        copyResetTimeoutRef.current = null;
      }, 1200);
    }
  };

  return (
    <article
      className={`w-full ${featured ? "lg:self-center" : ""} ${cardHeightClass} mc-perspective`}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`relative ${cardHeightClass} w-full mc-transform-style-preserve-3d transition-transform duration-500 will-change-transform motion-reduce:transition-none`}
        style={{
          WebkitTransform: cardTransform,
          WebkitTransformStyle: "preserve-3d",
          transform: cardTransform,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden={isFlipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl border p-5 text-white mc-backface-hidden ${frontFaceClass} ${
            isFlipped ? "pointer-events-none" : ""
          }`}
          style={frontFaceStyle}
        >
          <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} aria-hidden="true" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <StatusBadge
                tone={isHomeDepot ? "orange" : "cyan"}
                className="border-white/15 bg-white/10 text-slate-100"
              >
                {isHomeDepot ? "Production platform" : "Engineering signal"}
              </StatusBadge>
              <h3 id={titleId} className="mt-4 text-2xl font-black leading-tight text-white">
                {title}
              </h3>
              <p className={`mt-2 text-base font-black ${accentTextClass}`}>{company}</p>
            </div>
            <div className="text-right text-sm font-bold text-slate-300">
              <p>{date}</p>
              <p className="mt-1">{location}</p>
            </div>
          </div>

          <div className={`${logoBayClass} ${logoTileClass}`}>
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className={logoImageClass}
            />
          </div>

          <div className="mt-auto flex justify-end">
            <button
              ref={detailsButtonRef}
              type="button"
              onClick={showDetails}
              tabIndex={isFlipped ? -1 : 0}
              aria-label={`View details for ${title} at ${company}`}
              aria-expanded={isFlipped}
              aria-controls={detailsId}
              className={detailsButtonClass}
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
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[#2563EB]/35 bg-[#0B1220] p-5 text-white mc-backface-hidden mc-rotate-y-180 ${
            isFlipped ? "" : "pointer-events-none"
          }`}
          style={backFaceStyle}
        >
          <div className="absolute right-4 top-4 z-10 flex flex-col items-center group">
            <button
              type="button"
              onClick={handleCopy}
              tabIndex={isFlipped ? 0 : -1}
              aria-label={`Copy ${title} details`}
              className="relative flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white transition hover:border-[#2563EB] hover:bg-white/15 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#0B1220]"
            >
              <FaClipboard
                className={`h-4 w-4 transition-opacity duration-200 ${
                  copyStatus === "success" ? "opacity-0" : "opacity-100"
                }`}
                aria-hidden="true"
              />
              <FaCheck
                className={`absolute h-4 w-4 text-emerald-300 transition-opacity duration-200 ${
                  copyStatus === "success" ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              />
            </button>

            <span
              className={`mt-2 rounded-sm bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-xs transition-all duration-200 ${
                copyStatus
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
              }`}
            >
              {copyStatus === "success" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy"}
            </span>
            <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {copyStatusMessage}
            </span>
          </div>

          <p className="text-xs font-black uppercase text-[#93B4FF]">Operational record</p>
          <h3 id={`${detailsId}-heading`} className="mt-2 pr-16 text-xl font-black">
            Experience Details
          </h3>

          <div className="mt-4 flex-1 overflow-y-auto pr-2">
            <ul className="space-y-3">
              {bullets.map((bullet, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${accentClass}`} />
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
            aria-label={`Hide details for ${title} at ${company}`}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-[#2563EB] hover:bg-white/15 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#0B1220] sm:w-fit sm:py-2"
          >
            <FaArrowLeft className="mr-2" aria-hidden="true" />
            Back
          </button>
        </div>
      </div>
    </article>
  );
};

export default ExperienceCard;
