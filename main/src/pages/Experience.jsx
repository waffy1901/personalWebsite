import React from "react";
import ExperienceCard from "../components/ExperienceCard";
import OwnershipCard from "../components/OwnershipCard";

import hdLogo from "../images/hdLogo.png";
import landisGyrLogo from "../images/landisGyrLogo.png";
import fintechGTLogo from "../images/fintechGTLogo.png";
import cdcLogo from "../images/cdcLogo.png";
import gtComputingLogo from "../images/gtComputingLogo.png";

/* =========================
   Experience Grid
========================= */
const ExperienceGrid = ({ experiences, isExtracurricular, centerIndex }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {experiences.map((exp, index) => (
        <div
          key={index}
          className={`w-full ${
            index === centerIndex ? "md:col-span-2 flex justify-center" : ""
          }`}
        >
          <div
            className={`w-full ${
              index === centerIndex ? "md:w-3/4 lg:w-1/2" : ""
            }`}
          >
            <ExperienceCard {...exp} isExtracurricular={isExtracurricular} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* =========================
   Experience Page
========================= */
function Experience() {
  const workExperiences = [
    {
      title: "Software Engineer",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "January 2025 - Present",
      bullets: [
        "Improved scalability by deploying and validating HPA for a core service previously capped at 20 static pods, cutting mean latency 40% (121 to 72 ms) and errors 89% while boosting throughput 40% (24.9M to 34.8M reqs/wk) and reducing average CPU usage 26%, enabling dynamic scaling between 50–100 pods in production.",
        "Reconstructed deployment workflows for abandoned legacy Java 1.8 Tomcat services supporting mission-critical transaction systems with no existing operational ownership, rebuilding CI/CD pipelines and enabling zero-downtime Cassandra credential rotation across 8 repositories while eliminating a critical platform outage risk.",
        "Led testing and validation to disable a legacy service component handling ∼27% of transaction volume (14.5 million daily captures/lookups) using BigQuery and Postman, supporting a phased retirement effort involving 12 teams.",
        "Reduced MTTR ∼50% by implementing an automated rolling-restart Kubernetes job for 20+ microservices.",
        "Automated Spinnaker deployment pipelines for 15+ microservices with cdk8s.",
        "Ensured data integrity via bidirectional XML ↔ JSON transformations across 1000+ production fields.",
        "Reduced lookup latency by 5% in a 10M/day system using bucketed Elasticsearch indexing.",
        "Reduced production incidents by 20% via OpenTelemetry tracing across 8 services.",
        "Resolved critical transaction issues across 500+ stores maintaining ~100% availability.",
        "Validated fault tolerance via chaos experiments and k6 stress testing.",
        "Improved alert acknowledgement times 30% via Grafana + PagerDuty optimization.",
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]",
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2024 - July 2024",
      bullets: [
        "Developed an internal product information page reducing associate intervention wait times ~25%.",
        "Displayed product data across all registers using Java + React, reducing theft by ~$10M annually.",
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]",
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2023 - July 2023",
      bullets: [
        "Optimized configuration efficiency for 40,000+ registers across 2,300 stores by 90%.",
        "Reduced deployment time from 24+ hours → 30 minutes using Java HttpClient + Flow.",
        "Built UI components with React, Next.js, and TypeScript.",
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]",
    },
    {
      title: "Firmware Engineer Intern",
      company: "Landis+Gyr",
      location: "Alpharetta, GA",
      date: "May 2022 - August 2022",
      bullets: [
        "Accelerated DCW hex → ASCII conversion by ~50% using Python optimizations.",
        "Improved data transmission efficiency ~25% through collector testing/debugging.",
      ],
      logo: landisGyrLogo,
      color: "bg-white bg-opacity-100",
    },
  ];

  const extracurricularExperiences = [
    {
      title: "Frontend Engineer",
      company: "Fintech @ Georgia Tech",
      location: "Atlanta, GA",
      date: "September 2024 - November 2024",
      bullets: [
        "Reduced page load times ~35% converting site to React SPA.",
        "Implemented React Native cart with Stripe payments.",
        "Built image-recognition ranking integration.",
      ],
      logo: fintechGTLogo,
      color: "bg-[#FFD700] bg-opacity-70",
    },
    {
      title: "Project Manager & Full-Stack Developer",
      company: "Centers for Disease Control and Prevention",
      location: "Atlanta, GA",
      date: "August 2023 - April 2024",
      bullets: [
        "Led team of 6 automating reconciliation across 50 state health departments.",
        "Saved 5000+ hours annually via Python discrepancy detection.",
        "Built React visualization dashboards.",
        "Developed FastAPI statistics endpoint.",
      ],
      logo: cdcLogo,
      color: "bg-white bg-opacity-100",
    },
    {
      title: "Undergraduate Teaching Assistant",
      company: "Georgia Tech College of Computing",
      location: "Atlanta, GA",
      date: "January 2023 - May 2023",
      bullets: [
        "Taught recitations for 20+ students weekly.",
        "Graded coursework and provided feedback.",
        "Answered 105+ Piazza questions.",
      ],
      logo: gtComputingLogo,
      color: "bg-[#FFD700] bg-opacity-70",
    },
  ];

  return (
    <div className="bg-blue-300 min-h-screen py-4 font-cambria">
      <div className="max-w-6xl mx-auto px-4 space-y-10">

        {/* ================= Work Experience ================= */}
        <section>
          <h2 className="text-3xl text-center font-bold mb-6">
            Work Experience
          </h2>

          <ExperienceGrid
            experiences={workExperiences}
            isExtracurricular={false}
          />
        </section>

        {/* ================= Platform Ownership ================= */}
        <section>
          <h2 className="text-3xl text-center font-bold mb-6">
            Platform Ownership & Engineering Impact
          </h2>

          {/*SCOPE BAR */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {[
              "60+ Repositories",
              "Primary Escalation Point",
              "Shared Auth Infrastructure",
            ].map((chip, i) => (
              <span
                key={i}
                className="px-4 py-1 text-sm font-medium bg-white/70 backdrop-blur-sm text-gray-800 rounded-full shadow-sm"
              >
                {chip}
              </span>
            ))}
          </div>

          {/* Centered Ownership Card */}
          <div className="w-full">
              <OwnershipCard
                color="bg-[#FFA500] bg-opacity-90"
                title="Software Engineer, The Home Depot"
                items={[
                  "Serve as a trusted operational contributor within a senior/staff-heavy platform organization, acting as a primary escalation point for infrastructure, DevOps, and CI/CD issues across shared services and ~60+ repositories.",
                  "Act as a production quality gate reviewing and approving deployment changes to ensure release safety and operational consistency.",
                  "Contribute to administration and continuity of shared authentication infrastructure enabling secure cross-service communication.",
                  "Supported large-scale Kubernetes cluster rebuilds coordinating scaling, traffic migration, and Terraform-driven recovery with no service disruption.",
                ]}
              />
          </div>
        </section>

        {/* ================= Extracurricular ================= */}
        <section>
          <h2 className="text-3xl text-center font-bold mb-8">
            Extracurricular Experience
          </h2>

          <ExperienceGrid
            experiences={extracurricularExperiences}
            isExtracurricular={true}
            centerIndex={2}
          />
        </section>

      </div>
    </div>
  );
}

export default Experience;