import React from "react";
import { HiCog, HiLockClosed, HiServer, HiShieldCheck } from "react-icons/hi";
import ExperienceCard from "../components/ExperienceCard";
import {
  ImpactBand,
  PageContainer,
  PageShell,
  PresentationPanel,
  SectionHeader,
} from "../components/MissionControl.jsx";
import {
  experiencePage,
  extracurricularExperiences,
  ownershipAreas,
  workExperiences,
} from "../data/experience";

const ownershipIconById = {
  server: HiServer,
  shield: HiShieldCheck,
  lock: HiLockClosed,
  cog: HiCog,
};

const impactMetrics = [
  {
    value: "60+",
    label: "shared-service repositories",
    detail: "Production ownership across platform services.",
  },
  {
    value: "89%",
    label: "fewer production errors",
    detail: "Measured after Horizontal Pod Autoscaling (HPA) rollout.",
    tone: "orange",
  },
  {
    value: "8",
    label: "legacy repos recovered",
    detail: "Deployment workflows rebuilt for credential rotation.",
  },
  {
    value: "500+",
    label: "stores supported",
    detail: "Transaction-critical issue resolution and support.",
  },
];

const timelineRankById = {
  "fintech-gt-frontend-engineer": 0,
  "home-depot-intern-2024": 1,
  "cdc-project-manager-full-stack-developer": 2,
  "home-depot-intern-2023": 3,
  "gt-undergraduate-teaching-assistant": 4,
  "landis-gyr-firmware-intern": 5,
};

function TimelineEntry({ experience }) {
  return (
    <article className="relative border-l border-slate-300 pb-8 pl-6 last:pb-0">
      <span className="absolute -left-2 top-1 h-4 w-4 rounded-full border-2 border-[#F4F1EA] bg-[#2563EB]" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-[#0B1220]">{experience.title}</h3>
          <p className="mt-1 font-bold text-slate-700">{experience.company}</p>
        </div>
        <div className="text-sm font-bold text-slate-500 sm:text-right">
          <p>{experience.date}</p>
          <p>{experience.location}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {experience.bullets.slice(0, 3).map((bullet) => (
          <li key={bullet} className="text-sm leading-relaxed text-slate-600">
            {bullet}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Experience() {
  const [currentRole, ...earlierWork] = workExperiences;
  const timelineExperiences = [...earlierWork, ...extracurricularExperiences].sort(
    (a, b) => (timelineRankById[a.id] ?? 99) - (timelineRankById[b.id] ?? 99)
  );

  return (
    <PageShell>
      <PageContainer className="space-y-12">
        <SectionHeader
          eyebrow="Career story"
          title={experiencePage.workHeading}
          description="Production ownership across more than 60 shared-service repositories, with reliability, deployment automation, observability, and incident response work tied to measurable outcomes."
        />

        <ImpactBand items={impactMetrics} />

        {currentRole ? (
          <PresentationPanel
            aria-labelledby="current-role-heading"
            className="p-5 text-white sm:p-7"
          >
            <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(24rem,1.02fr)] lg:items-stretch">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFB077]">
                  {experiencePage.ownershipEyebrow}
                </p>
                <h2
                  id="current-role-heading"
                  className="mt-5 text-4xl font-black leading-tight sm:text-5xl"
                >
                  Platform ownership as a connected production system.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-slate-300">
                  The role spans release safety, shared infrastructure, incident
                  response, and production recovery for transaction-critical systems.
                </p>

                <div className="mt-8 grid gap-4">
                  {ownershipAreas.map((area, index) => {
                    const Icon = ownershipIconById[area.icon];
                    return (
                      <article
                        key={area.id}
                        className="relative border-l-2 border-white/15 pl-5"
                      >
                        <span
                          className={`absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full ${
                            index === 1 ? "bg-[#F96302]" : "bg-[#2563EB]"
                          }`}
                        />
                        <div className="flex items-start gap-3">
                          <span className="mt-1 text-[#F96302]">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div>
                            <h3 className="text-lg font-black">{area.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300">
                              {area.summary}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <ExperienceCard {...currentRole} featured />
            </div>
          </PresentationPanel>
        ) : null}

        <section
          aria-labelledby="earlier-roles-heading"
          className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        >
          <div>
            <p className="mc-eyebrow">Earlier roles</p>
            <h2
              id="earlier-roles-heading"
              className="text-3xl font-black text-[#0B1220]"
            >
              Foundation work, internships, and technical leadership.
            </h2>
          </div>

          <div className="mc-panel p-5">
            {timelineExperiences.map((experience) => (
              <TimelineEntry key={experience.id} experience={experience} />
            ))}
          </div>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default Experience;
