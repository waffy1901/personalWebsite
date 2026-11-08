import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import HackathonPrototype from "../components/HackathonPrototype.jsx";
import { hackathonPrototypeSummary as hackathonPrototype } from "../data/hackathonPrototypeSummary.js";
import { FaCodeBranch, FaDatabase, FaMobileAlt, FaUsers } from "react-icons/fa";
import {
  ImpactBand,
  PageContainer,
  PageShell,
  PresentationPanel,
  SectionHeader,
  StackChips,
  StatusBadge,
  SystemDiagram,
} from "../components/MissionControl.jsx";
import ProjectCard from "../components/ProjectCard";
import { projectStats, projects, projectsPage } from "../data/projects";

const statDetailById = {
  repos: "Public repositories with visible implementation work.",
  "data-apps": "Data-heavy tools for reconciliation and workflow support.",
  mobile: "Android experiences built around practical user flows.",
};

const projectFlowNodes = [
  {
    label: "State datasets",
    detail: "50 departments",
    tone: "blue",
    icon: FaDatabase,
  },
  {
    label: "Python compare",
    detail: "Discrepancy checks",
    tone: "orange",
    icon: FaCodeBranch,
  },
  {
    label: "FastAPI stats",
    detail: "Reviewable metrics",
    tone: "green",
    icon: FaDatabase,
  },
  {
    label: "React review",
    detail: "Filtering UI",
    tone: "blue",
    icon: FaMobileAlt,
  },
  {
    label: "Stakeholders",
    detail: "25+ reviewers",
    tone: "purple",
    icon: FaUsers,
  },
  {
    label: "Saved time",
    detail: "5000+ hours",
    tone: "orange",
    icon: FaCodeBranch,
  },
];

function getProjectId(hash) {
  try {
    const id = decodeURIComponent(hash.slice(1));
    return projects.some((project) => project.id === id) ? id : null;
  } catch {
    return null;
  }
}

function Projects({ restoreSummaryFocus }) {
  const { pathname, search, hash, key } = useLocation();
  const navigate = useNavigate();
  const selectedId = getProjectId(hash);
  const previousSelectedId = useRef(null);

  useEffect(() => {
    const targetId = selectedId ?? (restoreSummaryFocus ? previousSelectedId.current : null);
    previousSelectedId.current = selectedId;
    if (!targetId) return;

    // Restore the fragment after the lazy route and parent scroll reset commit.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        const toggle = target?.querySelector("[data-project-toggle]");

        if (selectedId) {
          target?.scrollIntoView?.({ block: "start", behavior: "instant" });
        }

        toggle?.focus({ preventScroll: true });
        toggle?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [key, selectedId, restoreSummaryFocus]);

  const selectProject = (id) => {
    navigate(
      { pathname, search, hash: id ? `#${id}` : "" },
      { state: { projectDetailChange: true } }
    );
  };

  const featuredProject = projects.find(
    (project) => project.id === "cdc-data-reconciliation"
  );
  const supportingProjects = projects.filter(
    (project) => project.github && project.id !== "cdc-data-reconciliation"
  );

  return (
    <PageShell>
      <PageContainer className="space-y-10">
        <SectionHeader
          eyebrow="Project portfolio"
          title={projectsPage.title}
          description={projectsPage.description}
        />

        <ImpactBand
          items={projectStats.map((stat) => ({
            value: stat.value,
            label: stat.label,
            detail: statDetailById[stat.id],
            tone: stat.id === "data-apps" ? "orange" : undefined,
          }))}
        />

        {featuredProject ? (
          <PresentationPanel
            aria-labelledby="featured-project-heading"
            className="p-5 text-white sm:p-7"
          >
            <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(21rem,1.08fr)] lg:items-center">
              <div>
                <StatusBadge tone="orange" surface="dark">Public build</StatusBadge>
                <h2
                  id="featured-project-heading"
                  className="mt-5 text-4xl font-black leading-tight sm:text-5xl"
                >
                  CDC Data Reconciliation
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-300">
                  Led a six-person team while contributing full-stack work on a
                  public health reconciliation platform that saved 5000+ hours
                  of manual review annually.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="border-l-4 border-[#F96302] pl-4">
                    <p className="text-3xl font-black">5000+</p>
                    <p className="text-sm font-black uppercase text-slate-300">
                      annual hours saved
                    </p>
                  </div>
                  <div className="border-l-4 border-[#2563EB] pl-4">
                    <p className="text-3xl font-black">6</p>
                    <p className="text-sm font-black uppercase text-slate-300">
                      team members led
                    </p>
                  </div>
                </div>

                <SystemDiagram
                  className="mt-7"
                  centerLabel="CDC reconciliation"
                  centerDetail="Data workflow"
                  nodes={projectFlowNodes}
                  caption="The project connected public-health datasets, comparison logic, API statistics, and a review interface for faster discrepancy analysis."
                />

                <StackChips
                  items={featuredProject.techStack.split(",").map((item) => item.trim())}
                  className="mt-6"
                />
              </div>

              <ProjectCard
                {...featuredProject}
                isFlipped={selectedId === featuredProject.id}
                onSelect={selectProject}
              />
            </div>
          </PresentationPanel>
        ) : null}

        <HackathonPrototype
          project={hackathonPrototype}
          isOpen={selectedId === hackathonPrototype.id}
          onSelect={selectProject}
        />

        <section aria-labelledby="supporting-projects-heading" className="space-y-5">
          <div>
            <p className="mc-eyebrow">Supporting builds</p>
            <h2
              id="supporting-projects-heading"
              className="text-3xl font-black text-[#0B1220]"
            >
              Mobile and workflow systems
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            {supportingProjects.map((project) => (
              <ProjectCard
                key={project.id}
                {...project}
                isFlipped={selectedId === project.id}
                onSelect={selectProject}
              />
            ))}
          </div>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default Projects;
