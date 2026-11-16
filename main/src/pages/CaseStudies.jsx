import React from "react";
import { Link } from "react-router";
import { FaArrowRight } from "react-icons/fa";
import {
  PageContainer,
  PageShell,
  PresentationPanel,
  SectionHeader,
  StatusBadge,
} from "../components/MissionControl.jsx";
import { caseStudies, caseStudiesPage } from "../data/caseStudyIndex.js";
import { trackEvent } from "../utils/analytics";
import { createRouteIntentHandlers } from "../utils/routePrefetch.js";

const logoFrameClassByTheme = {
  "home-depot": "border-[#F96302] bg-[#F96302]",
  cdc: "border-slate-200 bg-white",
};

function CaseStudyCard({ caseStudy, primary = false }) {
  const { featured, metricsLabel, slug, title } = caseStudy;
  const Heading = featured ? "h2" : "h3";
  const headingId = `${slug}-heading`;
  const to = `/case-studies/${slug}/`;

  return (
    <PresentationPanel
      as="article"
      aria-labelledby={headingId}
      className={`min-w-0 p-4 text-white sm:p-6 ${primary ? "border-[#FFB077]/60" : ""}`}
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <StatusBadge
              tone={primary ? "orange" : "cyan"}
              surface="dark"
            >
              {caseStudy.category}
            </StatusBadge>
            <p className="mt-2 text-sm font-bold text-slate-400">
              {caseStudy.organization} / {caseStudy.timeframe}
            </p>
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-md border p-1 ${logoFrameClassByTheme[caseStudy.logoTheme]}`}
          >
            <picture>
              <source srcSet={caseStudy.logoWebp} type="image/webp" />
              <img
                src={caseStudy.logo}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </picture>
          </span>
        </div>

        <Heading
          id={headingId}
          className={`mt-3 font-black leading-tight ${featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}
        >
          {title}
        </Heading>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.065] px-3 py-2">
          {metricsLabel ? (
            <p className="mb-1 text-xs font-bold text-slate-400">{metricsLabel}</p>
          ) : null}
          <ul role="list" aria-label={metricsLabel ?? "Outcomes"} className="space-y-1">
            {caseStudy.metrics.slice(0, featured ? 3 : 2).map((metric) => (
              <li key={metric.label} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-lg font-black leading-tight text-[#93B4FF]">
                  {metric.value}
                </span>
                <span className="leading-snug text-slate-200">{metric.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {caseStudy.summary}
        </p>

        <div className="mt-auto pt-4">
          <Link
            to={to}
            {...createRouteIntentHandlers(to)}
            aria-label={`Read case study on ${title}`}
            onClick={() =>
              trackEvent("case_study_card_click", {
                case_study_slug: slug,
                case_study_title: title,
                placement: "case_studies_grid",
              })
            }
            className={primary ? "mc-button-primary" : "mc-button-secondary"}
          >
            Read case study
            <FaArrowRight className="ml-2" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PresentationPanel>
  );
}

const featuredCaseStudies = caseStudies.filter(({ featured }) => featured);
const supportingCaseStudies = caseStudies.filter(({ featured }) => !featured);

function CaseStudies() {
  return (
    <PageShell>
      <PageContainer className="space-y-6 pt-6 sm:space-y-8 sm:pt-12">
        <SectionHeader
          title={caseStudiesPage.title}
          description={caseStudiesPage.description}
        />

        <section aria-label="Featured case studies" className="grid gap-4 lg:grid-cols-2">
          {featuredCaseStudies.map((caseStudy, index) => (
            <CaseStudyCard key={caseStudy.slug} caseStudy={caseStudy} primary={index === 0} />
          ))}
        </section>

        <section aria-labelledby="more-case-studies-heading">
          <h2 id="more-case-studies-heading" className="mb-4 text-2xl font-black text-[#0B1220]">
            More case studies
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {supportingCaseStudies.map((caseStudy) => (
              <CaseStudyCard key={caseStudy.slug} caseStudy={caseStudy} />
            ))}
          </div>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default CaseStudies;
