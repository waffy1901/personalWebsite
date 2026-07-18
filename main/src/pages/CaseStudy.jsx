import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaArrowRight,
  FaChartLine,
  FaCodeBranch,
  FaExternalLinkAlt,
  FaServer,
} from "react-icons/fa";
import {
  ImpactBand,
  PageContainer,
  PageShell,
  PresentationPanel,
  StackChips,
  StatusBadge,
  SystemDiagram,
} from "../components/MissionControl.jsx";
import { getCaseStudyBySlug } from "../data/caseStudies";
import { trackLinkClick } from "../utils/analytics";
import NotFound from "./NotFound";

const logoFrameClassByTheme = {
  "home-depot": "border-[#F96302] bg-[#F96302]",
  cdc: "border-slate-200 bg-white",
};

const detailFlowIcons = [FaServer, FaCodeBranch, FaChartLine];

function buildDetailNodes(caseStudy) {
  const flowNodes = caseStudy.flow.map((step, index) => ({
    label: step.title,
    detail: `Step ${index + 1}`,
    tone: index === 1 ? "orange" : "blue",
    icon: detailFlowIcons[index] ?? FaCodeBranch,
  }));
  const metricNodes = caseStudy.metrics.slice(0, 3).map((metric, index) => ({
    label: metric.value,
    detail: metric.label,
    tone: index === 1 ? "orange" : index === 2 ? "green" : "purple",
    icon: index === 0 ? FaChartLine : FaArrowRight,
  }));

  return [...flowNodes, ...metricNodes];
}

function CaseStudy() {
  const { slug } = useParams();
  const caseStudy = getCaseStudyBySlug(slug);

  if (!caseStudy) {
    return <NotFound />;
  }

  return (
    <PageShell>
      <PageContainer>
        <Link
          to="/case-studies"
          className="mb-5 inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-[#0B1220] transition hover:border-[#2563EB]/50 hover:bg-[#E8EDF2] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
        >
          <FaArrowLeft className="mr-2" aria-hidden="true" />
          Case Studies
        </Link>

        <PresentationPanel as="header" className="p-5 text-white sm:p-7">
          <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)] lg:items-start">
            <div>
              <StatusBadge tone={caseStudy.logoTheme === "home-depot" ? "orange" : "cyan"}>
                {caseStudy.category}
              </StatusBadge>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">
                {caseStudy.title}
              </h1>
              <p className="mt-3 text-base font-bold text-[#93B4FF]">
                {caseStudy.organization} / {caseStudy.timeframe}
              </p>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">
                {caseStudy.summary}
              </p>
            </div>

            <div className="grid gap-4">
              <span
                className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border p-2 ${logoFrameClassByTheme[caseStudy.logoTheme]}`}
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
              <SystemDiagram
                centerLabel={caseStudy.category}
                centerDetail={caseStudy.organization}
                nodes={buildDetailNodes(caseStudy)}
                caption="The writeup keeps system context, rollout path, and measured evidence in the same frame."
              />
            </div>
          </div>
        </PresentationPanel>

        <section
          aria-labelledby="case-study-metrics"
          className="mt-5"
        >
          <h2 id="case-study-metrics" className="sr-only">
            Case study metrics
          </h2>
          <ImpactBand
            items={caseStudy.metrics.map((metric, index) => ({
              value: metric.value,
              label: metric.label,
              detail: metric.detail,
              tone: index === 1 ? "orange" : undefined,
            }))}
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <section aria-labelledby="case-study-flow" className="mc-panel p-5">
              <h2 id="case-study-flow" className="text-2xl font-black text-[#0B1220]">
                Engineering path
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {caseStudy.flow.map((step, index) => (
                  <div key={step.title} className="rounded-lg border border-slate-200 bg-[#E8EDF2] p-4">
                    <p className="text-xs font-black uppercase text-[#2563EB]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-3 text-lg font-black text-[#0B1220]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {caseStudy.sections.map((section) => (
              <section key={section.heading} className="mc-panel p-5">
                <h2 className="text-2xl font-black text-[#0B1220]">{section.heading}</h2>
                <div className="mt-4 space-y-3 text-base leading-relaxed text-slate-700">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="mc-panel h-fit p-5 lg:sticky lg:top-24">
            <h2 className="text-xl font-black text-[#0B1220]">Stack</h2>
            <StackChips items={caseStudy.stack} className="mt-4" />

            <h2 className="mt-7 text-xl font-black text-[#0B1220]">Related links</h2>
            <div className="mt-4 grid gap-2">
              {caseStudy.links.map((link) =>
                link.to ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() =>
                      trackLinkClick("case_study_link_click", {
                        href: link.to,
                        label: link.label,
                        placement: "case_study_related_links",
                        case_study_slug: caseStudy.slug,
                        link_type: "internal",
                      })
                    }
                    className="mc-button-light"
                  >
                    {link.label}
                    <FaArrowRight className="ml-2" aria-hidden="true" />
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackLinkClick("case_study_link_click", {
                        href: link.href,
                        label: link.label,
                        placement: "case_study_related_links",
                        case_study_slug: caseStudy.slug,
                        link_type: "external",
                      })
                    }
                    className="inline-flex items-center justify-center rounded-md border border-[#F96302]/35 bg-[#F96302]/10 px-4 py-2 text-sm font-black text-[#b94600] transition hover:bg-[#F96302]/15 focus:outline-hidden focus:ring-2 focus:ring-[#F96302] focus:ring-offset-2"
                  >
                    {link.label}
                    <FaExternalLinkAlt className="ml-2" aria-hidden="true" />
                  </a>
                )
              )}
            </div>
          </aside>
        </div>
      </PageContainer>
    </PageShell>
  );
}

export default CaseStudy;
