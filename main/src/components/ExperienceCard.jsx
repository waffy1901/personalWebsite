import React, { useEffect, useId, useRef, useState } from "react";
import { FaCheck, FaClipboard } from "react-icons/fa";
import { Link } from "react-router";
import { StatusBadge } from "./MissionControl.jsx";
import { createRouteIntentHandlers } from "../utils/routePrefetch.js";

const ExperienceCard = ({
  title,
  company,
  location,
  date,
  bullets,
  highlights = [],
  highlightCaseStudies = [],
  logo,
  logoWebp,
  logoWidth,
  logoHeight,
}) => {
  const [copyStatus, setCopyStatus] = useState(null);
  const disclosureRef = useRef(null);
  const summaryRef = useRef(null);
  const copyResetTimeoutRef = useRef(null);
  const cardId = useId();
  const isHomeDepot = company === "The Home Depot";
  const accentClass = isHomeDepot ? "bg-[#F96302]" : "bg-[#2563EB]";
  const accentTextClass = isHomeDepot ? "text-[#FFB077]" : "text-[#93B4FF]";
  const copyStatusMessage =
    copyStatus === "success"
      ? `${title} details copied.`
      : copyStatus === "error"
      ? `${title} details could not be copied.`
      : "";

  useEffect(() => () => {
    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
  }, []);

  const collapseDetails = () => {
    disclosureRef.current.open = false;
    summaryRef.current?.focus({ preventScroll: true });
    summaryRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && disclosureRef.current?.open) {
      event.stopPropagation();
      collapseDetails();
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
      aria-labelledby={`${cardId}-title`}
      className="relative w-full min-w-0 rounded-2xl border border-white/10 bg-[#111827] p-5 text-white [overflow-wrap:anywhere]"
      onKeyDown={handleKeyDown}
    >
      <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl ${accentClass}`} aria-hidden="true" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-40">
          <StatusBadge tone={isHomeDepot ? "orange" : "cyan"} surface="dark">
            {isHomeDepot ? "Production platform" : "Engineering signal"}
          </StatusBadge>
          <h3 id={`${cardId}-title`} className="mt-4 text-2xl font-black leading-tight text-white">
            {title}
          </h3>
          <p className={`mt-2 text-base font-black ${accentTextClass}`}>{company}</p>
        </div>
        <picture className="w-20 max-w-full shrink-0">
          <source srcSet={logoWebp} type="image/webp" />
          <img
            src={logo}
            width={logoWidth}
            height={logoHeight}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="h-auto w-full object-contain"
          />
        </picture>
      </div>
      <div className="mt-4 text-sm font-bold text-slate-300">
        <p>{date}</p>
        <p className="mt-1">{location}</p>
      </div>

      <ul aria-label="Recent engineering outcomes" className="mt-6 space-y-5">
        {highlights.map((highlight, index) => {
          const study = highlightCaseStudies[index];
          const to = study ? `/case-studies/${study.slug}/` : null;
          return (
            <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-slate-200">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${accentClass}`} aria-hidden="true" />
              <span className="min-w-0">
                {study ? <span className={`mb-1 block font-black ${accentTextClass}`}>{study.label}</span> : null}
                <span className="block">{highlight}</span>
                {study ? (
                  <Link to={to} {...createRouteIntentHandlers(to)} className="mt-2 inline-block rounded-sm font-bold text-[#93B4FF] underline underline-offset-4 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#111827]">
                    Read {study.title}
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <details ref={disclosureRef} className="mt-6 border-t border-white/15 pt-4">
        <summary ref={summaryRef} className="cursor-pointer rounded-sm text-sm font-black text-[#93B4FF] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#111827]">
          Full accomplishments for {title} at {company}
        </summary>
        <div role="region" aria-labelledby={`${cardId}-details-heading`} className="mt-5">
          <h4 id={`${cardId}-details-heading`} className="text-lg font-black">Full experience details</h4>
          <ul className="mt-4 space-y-4">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${accentClass}`} aria-hidden="true" />
                <span className="min-w-0">{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={handleCopy} aria-label={`Copy full accomplishments for ${title} at ${company}`} className="mc-button-secondary max-w-full whitespace-normal">
              {copyStatus === "success" ? <FaCheck className="mr-2 shrink-0" aria-hidden="true" /> : <FaClipboard className="mr-2 shrink-0" aria-hidden="true" />}
              Copy full accomplishments
            </button>
            <button type="button" onClick={collapseDetails} className="mc-button-secondary max-w-full whitespace-normal">
              Collapse full accomplishments
            </button>
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-sm text-slate-200">{copyStatusMessage}</p>
        </div>
      </details>
    </article>
  );
};

export default ExperienceCard;
