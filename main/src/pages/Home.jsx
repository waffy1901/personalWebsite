import React from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaChartLine,
  FaCogs,
  FaDownload,
  FaMapMarkerAlt,
  FaNetworkWired,
  FaRegClock,
  FaServer,
} from "react-icons/fa";
import DeployDates from "../components/DeployDates";
import {
  ImpactBand,
  PageContainer,
  PageShell,
  PresentationPanel,
  SignalCard,
  StackChips,
  StatusBadge,
  SystemDiagram,
} from "../components/MissionControl.jsx";
import SocialLinks from "../components/SocialLinks";
import { deployInfo, profile, resume } from "../data/profile";
import { trackEvent } from "../utils/analytics";

const impactMetrics = [
  {
    value: "34.8M",
    label: "weekly requests",
    detail: "Validated autoscaling under production load.",
  },
  {
    value: "89%",
    label: "fewer errors",
    detail: "Measured after HPA rollout on a core service.",
    tone: "orange",
  },
  {
    value: "60+",
    label: "repositories supported",
    detail: "Shared-service ownership across platform work.",
  },
  {
    value: "5000+",
    label: "hours saved annually",
    detail: "Manual reconciliation converted into workflows.",
  },
];

const focusAreas = [
  "Kubernetes autoscaling",
  "CI/CD recovery",
  "Observability",
  "Incident response",
  "Deployment automation",
  "High-throughput systems",
];

const heroSignals = [
  {
    label: "Problem",
    title: "Production systems cannot depend on guesswork.",
    detail: "Traffic, releases, incidents, and legacy paths need evidence-rich ownership.",
  },
  {
    label: "Approach",
    title: "Trace the system before changing it.",
    detail: "I pair deployment work with observability, validation, and rollback-aware thinking.",
  },
  {
    label: "Outcome",
    title: "Make reliability legible to technical and hiring audiences.",
    detail: "The portfolio surfaces impact first, then keeps the engineering trail inspectable.",
  },
];

const autoscalingNodes = [
  {
    label: "Traffic baseline",
    detail: "24.9M req/wk",
    tone: "blue",
    icon: FaNetworkWired,
  },
  {
    label: "HPA policy",
    detail: "50-100 pods",
    tone: "orange",
    icon: FaServer,
  },
  {
    label: "Grafana",
    detail: "Latency + errors",
    tone: "green",
    icon: FaRegClock,
  },
  {
    label: "Throughput",
    detail: "34.8M req/wk",
    tone: "blue",
    icon: FaChartLine,
  },
  {
    label: "CPU pressure",
    detail: "26% lower",
    tone: "purple",
    icon: FaCogs,
  },
  {
    label: "Recovery",
    detail: "89% fewer errors",
    tone: "orange",
    icon: FaArrowRight,
  },
];

const routeCards = [
  {
    label: "Case Studies",
    to: "/case-studies",
    title: "Production outcomes",
    detail: "Reliability, deployment recovery, and data systems with measurable results.",
  },
  {
    label: "Experience",
    to: "/experience",
    title: "Career story",
    detail: "Platform ownership, release governance, infrastructure auth, and recovery work.",
  },
  {
    label: "Projects",
    to: "/projects",
    title: "Build portfolio",
    detail: "Full-stack and mobile projects shaped around practical workflows.",
  },
];

function Home() {
  return (
    <PageShell>
      <section className="mc-dark-field px-3 py-4 text-white sm:px-5 sm:py-7">
        <PageContainer className="max-w-7xl py-0 sm:py-0">
          <PresentationPanel className="p-5 sm:p-8 lg:p-10">
            <div className="relative z-10 grid min-h-[calc(100dvh-8rem)] gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-center">
              <div className="mc-rise">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFB077]">
                  Platform & Reliability Engineering
                </p>
                <div className="mc-line-reveal mt-4 h-px w-40 bg-[#F96302]" aria-hidden="true" />

                <h1 className="mt-8 max-w-4xl text-5xl font-black leading-none sm:text-7xl">
                  {profile.name}
                </h1>
                <p className="mt-5 max-w-3xl text-2xl font-black leading-tight text-white sm:text-3xl">
                  I build production systems that stay reliable under pressure.
                </p>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Software engineer focused on Kubernetes, deployment automation,
                  observability, and high-throughput backend systems.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href={resume.pdf}
                    download
                    onClick={() =>
                      trackEvent("resume_download", {
                        placement: "home_header",
                      })
                    }
                    className="mc-button-primary"
                  >
                    <FaDownload className="mr-2" aria-hidden="true" />
                    Download Resume
                  </a>
                  <Link to="/contact" className="mc-button-secondary">
                    Contact
                    <FaArrowRight className="ml-2" aria-hidden="true" />
                  </Link>
                </div>

                <StackChips items={focusAreas} className="mt-8" />
              </div>

              <aside className="relative mx-auto w-full max-w-md lg:mr-0">
                <div className="absolute -right-3 -top-3 h-28 w-28 border-r-4 border-t-4 border-[#B3A369]" aria-hidden="true" />
                <div className="absolute -bottom-3 -left-3 h-28 w-28 border-b-4 border-l-4 border-[#F96302]" aria-hidden="true" />

                <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-2 shadow-[0_26px_80px_rgba(0,0,0,0.36)]">
                  <img
                    src={profile.profilePicture}
                    alt={profile.name}
                    className="h-[30rem] w-full rounded-2xl object-cover object-center"
                  />
                </div>

                <div className="absolute left-4 top-4 rounded-2xl border border-white/15 bg-[#0B1220]/90 px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                  <p className="font-black">Software Engineer</p>
                  <p className="mt-1 flex items-center gap-2 text-slate-300">
                    <FaMapMarkerAlt className="h-3 w-3 text-[#F96302]" aria-hidden="true" />
                    Atlanta, GA
                  </p>
                </div>

                <div className="absolute -right-1 bottom-24 rounded-2xl border border-white/15 bg-white px-4 py-3 text-[#0B1220] shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <p className="text-3xl font-black">34.8M</p>
                  <p className="text-xs font-black uppercase text-slate-600">weekly requests</p>
                </div>

                <div className="absolute -left-1 bottom-8 rounded-2xl border border-white/15 bg-[#0B1220] px-4 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <p className="text-3xl font-black text-[#F96302]">500+</p>
                  <p className="text-xs font-black uppercase text-slate-300">stores supported</p>
                </div>
              </aside>
            </div>

            <div className="relative z-10 mt-8 grid gap-4 lg:grid-cols-3">
              {heroSignals.map((signal) => (
                <SignalCard key={signal.label} {...signal} />
              ))}
            </div>
          </PresentationPanel>
        </PageContainer>
      </section>

      <section className="bg-[#F4F1EA]">
        <PageContainer className="space-y-8">
          <ImpactBand items={impactMetrics} />

          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="mc-eyebrow">Engineering signal</p>
              <h2 className="text-4xl font-black leading-tight text-[#0B1220]">
                Reliable systems first. Technical depth immediately after the scan.
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-slate-600">
              {profile.intro}
            </p>
          </div>
        </PageContainer>
      </section>

      <section className="mc-blue-section text-white">
        <PageContainer className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div>
            <StatusBadge tone="orange">Featured case study</StatusBadge>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
              Kubernetes autoscaling for transaction-critical services.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#DCE8FF]">
              A core service moved from fixed static capacity to validated dynamic
              scaling, improving latency, errors, throughput, and CPU efficiency
              under production traffic.
            </p>
            <Link to="/case-studies/kubernetes-autoscaling" className="mc-button-primary mt-7">
              Read the case study
              <FaArrowRight className="ml-2" aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.075] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-5">
            <SystemDiagram
              centerLabel="Autoscaling rollout"
              centerDetail="Production reliability"
              nodes={autoscalingNodes}
              caption="The rollout connected traffic baselines, Kubernetes scaling behavior, and observability signals before declaring the outcome."
            />
            <ImpactBand
              surface="dark"
              className="mc-impact-band-compact mt-5 lg:grid-cols-4"
              items={[
                { value: "40%", label: "lower latency" },
                { value: "89%", label: "fewer errors", tone: "orange" },
                { value: "26%", label: "lower CPU" },
                { value: "50-100", label: "dynamic pods" },
              ]}
            />
          </div>
        </PageContainer>
      </section>

      <section className="bg-[#E8EDF2]">
        <PageContainer className="space-y-8">
          <div>
            <p className="mc-eyebrow">Explore</p>
            <h2 className="max-w-3xl text-4xl font-black leading-tight text-[#0B1220]">
              Inspect the portfolio through outcomes, ownership, or builds.
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3" aria-label="Portfolio routes">
            {routeCards.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="mc-panel group block p-5 transition hover:-translate-y-1 hover:border-[#2563EB]/40 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 motion-reduce:hover:translate-y-0"
              >
                <p className="text-xs font-black uppercase text-[#2563EB]">{card.label}</p>
                <h3 className="mt-3 text-2xl font-black text-[#0B1220]">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.detail}</p>
                <span className="mt-5 inline-flex items-center text-sm font-black text-[#0B1220]">
                  Open
                  <FaArrowRight
                    className="ml-2 text-[#F96302] transition group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>

          <div className="mc-panel p-5">
            <p className="text-sm font-black uppercase text-slate-500">Connect</p>
            <SocialLinks placement="home" className="mt-4 flex flex-wrap gap-2" />
          </div>

          <DeployDates first={deployInfo.firstPublishedAt} />
        </PageContainer>
      </section>
    </PageShell>
  );
}

export default Home;
