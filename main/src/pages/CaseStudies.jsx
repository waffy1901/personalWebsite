import React from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaChartLine, FaCodeBranch, FaServer } from "react-icons/fa";
import {
  ImpactBand,
  PageContainer,
  PageShell,
  SectionHeader,
  StatusBadge,
  SystemDiagram,
} from "../components/MissionControl.jsx";
import { caseStudies, caseStudiesPage } from "../data/caseStudies";
import { trackEvent } from "../utils/analytics";

const logoFrameClassByTheme = {
  "home-depot": "border-[#F96302] bg-[#F96302]",
  cdc: "border-slate-200 bg-white",
};

const flowIcons = [FaServer, FaCodeBranch, FaChartLine];

function buildCaseStudyNodes(caseStudy) {
  const flowNodes = caseStudy.flow.map((step, index) => ({
    label: step.title,
    detail: `Step ${index + 1}`,
    tone: index === 1 ? "orange" : "blue",
    icon: flowIcons[index] ?? FaCodeBranch,
  }));
  const metricNodes = caseStudy.metrics.slice(0, 3).map((metric, index) => ({
    label: metric.value,
    detail: metric.label,
    tone: index === 1 ? "orange" : index === 2 ? "green" : "purple",
    icon: index === 0 ? FaChartLine : FaArrowRight,
  }));

  return [...flowNodes, ...metricNodes];
}

function CaseStudyCard({ caseStudy, featured = false }) {
  const cardClass = featured
    ? "mc-presentation-panel p-5 text-white sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)] lg:gap-8"
    : "mc-presentation-panel flex min-h-[28rem] flex-col p-5 text-white";
  const mutedText = "text-slate-300";
  const titleText = "text-white";
  const metaText = "text-slate-400";

  return (
    <article className={cardClass}>
      <div className={featured ? "relative z-10" : "relative z-10 flex flex-1 flex-col"}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <StatusBadge tone={caseStudy.logoTheme === "home-depot" ? "orange" : "cyan"}>
              {caseStudy.category}
            </StatusBadge>
            <p className={`mt-3 text-sm font-bold ${metaText}`}>
              {caseStudy.organization} / {caseStudy.timeframe}
            </p>
          </div>
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md border p-1 ${logoFrameClassByTheme[caseStudy.logoTheme]}`}
          >
            <img
              src={caseStudy.logo}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
          </span>
        </div>

        <h2 className={`text-3xl font-black leading-tight ${titleText}`}>
          {caseStudy.title}
        </h2>
        <p className={`mt-4 ${featured ? "max-w-3xl text-lg" : "text-sm"} flex-1 leading-relaxed ${mutedText}`}>
          {caseStudy.summary}
        </p>

        <Link
          to={`/case-studies/${caseStudy.slug}`}
          onClick={() =>
            trackEvent("case_study_card_click", {
              case_study_slug: caseStudy.slug,
              case_study_title: caseStudy.title,
              placement: "case_studies_grid",
            })
          }
          className={featured ? "mc-button-primary mt-6 w-fit" : "mc-button-secondary mt-5 w-fit"}
        >
          Read case study
          <FaArrowRight className="ml-2" aria-hidden="true" />
        </Link>
      </div>

      <div className={featured ? "relative z-10 mt-6 lg:mt-0" : "relative z-10 mt-5 grid gap-2"}>
        {featured ? (
          <SystemDiagram
            centerLabel={caseStudy.category}
            centerDetail={caseStudy.organization}
            nodes={buildCaseStudyNodes(caseStudy)}
            caption="Each case study keeps the problem, rollout path, and measured outcome connected for quick inspection."
          />
        ) : (
          caseStudy.metrics.slice(0, 2).map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-white/10 bg-white/[0.065] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <p className="text-2xl font-black text-[#93B4FF]">
                {metric.value}
              </p>
              <p className="text-sm font-bold text-slate-300">
                {metric.label}
              </p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function CaseStudies() {
  const [featuredCaseStudy, ...supportingCaseStudies] = caseStudies;

  return (
    <PageShell>
      <PageContainer className="space-y-10">
        <SectionHeader
          eyebrow="Case-study library"
          title={caseStudiesPage.title}
          description={caseStudiesPage.description}
        />

        <ImpactBand
          items={caseStudiesPage.stats.map((stat, index) => ({
            value: stat.value,
            label: stat.label,
            tone: index === 2 ? "orange" : undefined,
          }))}
        />

        <section className="space-y-6" aria-label="Case studies">
          {featuredCaseStudy ? (
            <CaseStudyCard caseStudy={featuredCaseStudy} featured />
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
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
