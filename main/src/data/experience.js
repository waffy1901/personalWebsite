import cdcLogo from "../images/cdcLogo.png"
import fintechGTLogo from "../images/fintechGTLogo.png"
import gtComputingLogo from "../images/gtComputingLogo.png"
import hdLogo from "../images/hdLogo.png"
import landisGyrLogo from "../images/landisGyrLogo.png"

export const experiencePage = {
  workHeading: "Work Experience",
  ownershipHeading: "Platform Ownership & Engineering Impact",
  ownershipEyebrow: "Software Engineer \u00b7 The Home Depot",
  extracurricularHeading: "Extracurricular Experience",
  centeredExtracurricularIndex: 2,
}

export const workExperiences = [
  {
    id: "home-depot-software-engineer",
    title: "Software Engineer",
    company: "The Home Depot",
    location: "Atlanta, GA",
    date: "January 2025 - Present",
    bullets: [
      "Improved scalability by deploying and validating HPA for a core service previously capped at 20 static pods, cutting mean latency 40% (121 to 72 ms) and errors 89% while boosting throughput 40% (24.9M to 34.8M reqs/wk) and reducing average CPU usage 26%, enabling dynamic scaling between 50\u2013100 pods in production.",
      "Reconstructed deployment workflows for abandoned legacy Java 1.8 Tomcat services supporting mission-critical transaction systems with no existing operational ownership, rebuilding CI/CD pipelines and enabling zero-downtime Cassandra credential rotation across 8 repositories while eliminating a critical platform outage risk.",
      "Remediated \u223c330 OS-level and Python CVEs across 13 microservices by migrating Docker builds from UBI8 to a minimal internal Artifactory base image, reverse-engineering undocumented build processes and resolving CI/CD 401 authentication failures to enable secure, reproducible container builds.",
      "Led testing and validation to disable a legacy service component handling \u223c27% of transaction volume (14.5 million daily captures/lookups) using BigQuery and Postman, supporting a phased retirement effort involving 12 teams.",
      "Reduced MTTR \u223c50% by implementing an automated rolling-restart Kubernetes job for 20+ microservices, eliminating slow Argo Rollouts sequences and accelerating recovery from memory-leak and state-drift issues.",
      "Automated Spinnaker deployment pipelines for 15+ microservices with cdk8s, standardizing multi-environment release workflows using TypeScript, Terraform, and GCP, reducing deployment times by 25%.",
      "Diagnosed and resolved post\u2013cluster-rebuild service timeouts (1s failures) by identifying stale node-level routing caused by NodePort usage; migrated internal services to ClusterIP, eliminating node dependency and restoring reliable service-to-service communication.",
      "Ensured data integrity for a legacy POS retirement initiative by implementing and validating bidirectional Java transformations between XML and JSON, enforcing round-trip schema equivalence across 1000+ production fields.",
      "Reduced lookup latency by 5% in a high-throughput system (10 million lookups per day) through a scalable, bucketed Elasticsearch indexing method using Java, enabling distributed lookups via partitioned indices.",
      "Reduced production incidents by 20% via implementing OpenTelemetry tracing across 8 Java-based microservices, enabling early issue detection through standardized distributed tracing and centralized observability.",
      "Resolved critical transaction processing/lookup issues across 500+ stores, collaborating with cross-functional teams and leveraging Cassandra, Elasticsearch, Java, BigQuery and Postman to maintain \u223c100% service availability.",
      "Validated fault tolerance via automated chaos experiments (SIGKILL terminations, CPU/memory overloads, and simulated network loss/latency) while stress testing via k6, uncovering and resolving bottlenecks in key services.",
      "Improved operational responsiveness by decreasing alert acknowledgement times 30% via optimizing tiered alerting and Grafana dashboards across 20+ microservices, automating escalation via Slack and PagerDuty integrations.",
    ],
    logo: hdLogo,
  },
  {
    id: "home-depot-intern-2024",
    title: "Software Engineer Intern",
    company: "The Home Depot",
    location: "Atlanta, GA",
    date: "May 2024 - July 2024",
    bullets: [
      "Developed an internal product information page for cashiers, streamlining self-checkout processes and reducing customer wait times for associate intervention by ~25%.",
      "Leveraged Java to obtain germane product data, used React and TypeScript to effectively display product information for all registers at self-checkout, pruning customer theft by \u223c$10 million annually.",
    ],
    logo: hdLogo,
  },
  {
    id: "home-depot-intern-2023",
    title: "Software Engineer Intern",
    company: "The Home Depot",
    location: "Atlanta, GA",
    date: "May 2023 - July 2023",
    bullets: [
      "Optimized the efficiency of configuring 40,000+ registers across 2,300 stores by 90%, in collaboration with 2 interns.",
      "Truncated the maximum deployment time of updates to registers from 24+ hours to 30 minutes, leveraging the HttpClient and Flow Java libraries to streamline the retrieval of polymorphic external configurations.",
      "Collaborated with cross-functional teams, including the UI/UX team, designing and constructing user interface components for a new configuration process - utilizing React, Next.js, and TypeScript.",
    ],
    logo: hdLogo,
  },
  {
    id: "landis-gyr-firmware-intern",
    title: "Firmware Engineer Intern",
    company: "Landis+Gyr",
    location: "Alpharetta, GA",
    date: "May 2022 - August 2022",
    bullets: [
      "Accelerated the process of converting DCW (Data Control Words) hexadecimal values to their corresponding ASCII representations by \u223c50% through efficient Python practices.",
      "Bolstered data transmission efficiency by \u223c25%, collaborating with a software architect to conduct comprehensive testing of collectors and debugging of various Python scripts employing MySQL.",
    ],
    logo: landisGyrLogo,
  },
]

export const ownershipAreas = [
  {
    id: "platform-ownership",
    icon: "server",
    title: "Platform Ownership",
    summary:
      "Own operational health across 60+ shared-service repositories, staying close to CI/CD, infrastructure, and transaction-critical production issues from triage through recovery.",
    details: [
      "First escalation point for CI/CD, infrastructure, and production issues impacting transaction capture across shared services.",
      "Operate within a senior/staff-heavy platform organization, driving resolution across cross-team boundaries.",
      "Triage and resolve infrastructure-level failures affecting upstream and downstream transaction-critical services.",
    ],
  },
  {
    id: "release-governance",
    icon: "shield",
    title: "Release Governance",
    summary:
      "Gate production releases by reviewing deployment changes before they reach shared environments, connecting Spinnaker, Kubernetes, and rollout standards to safer launches.",
    details: [
      "Prevent misconfigurations across multi-service rollouts by reviewing Spinnaker pipelines and Kubernetes manifests.",
      "Enforce deployment safety standards across 15+ microservices spanning multiple GCP environments.",
      "Coordinate staged rollouts for high-risk changes, ensuring operational consistency and zero regressions.",
    ],
  },
  {
    id: "infrastructure-auth",
    icon: "lock",
    title: "Infrastructure & Auth",
    summary:
      "Maintain shared authentication infrastructure across platform services, keeping credential rotation, service-to-service communication, and legacy continuity work reliable.",
    details: [
      "Ensure secure cross-service communication across platform-wide shared authentication layers.",
      "Administer credential rotation workflows, including zero-downtime Cassandra credential rotation across 8 repositories.",
      "Contribute to continuity of foundational auth services depended on by transaction-critical systems.",
    ],
  },
  {
    id: "production-operations",
    icon: "cog",
    title: "Production Operations",
    summary:
      "Lead production operations patterns for high-throughput services, from zero-downtime Kubernetes rebuilds to automated recovery paths for recurring runtime issues.",
    details: [
      "Coordinate traffic migration, scaling, and Terraform-based recovery during large-scale cluster rebuilds with no service disruption.",
      "Maintain automated rolling-restart Kubernetes jobs for 20+ microservices, enabling rapid recovery from memory-leak and state-drift issues.",
      "Support fault-tolerance validation through chaos experiments\u2014SIGKILL terminations, CPU/memory overloads, and simulated network failures.",
    ],
  },
]

export const extracurricularExperiences = [
  {
    id: "fintech-gt-frontend-engineer",
    title: "Frontend Engineer",
    company: "Fintech @ Georgia Tech",
    location: "Atlanta, GA",
    date: "September 2024 - November 2024",
    bullets: [
      "Reduced page load times by \u223c35% via transforming a multi-page credit card website into a React-based single-page application, streamlining card wallet management and adding a card removal feature for authenticated users.",
      "Implemented a cart page for a React Native grocery application, allowing users to add/remove items, adjust squantities, view real-time total costs, and integrated the Stripe API for streamlined in-app credit card payments.",
      "Leveraged an inbuilt API for image recognition, identifying and ranking the top 3 product matches for shopping carts.",
    ],
    logo: fintechGTLogo,
  },
  {
    id: "cdc-project-manager-full-stack-developer",
    title: "Project Manager & Full-Stack Developer",
    company: "Centers for Disease Control and Prevention",
    location: "Atlanta, GA",
    date: "August 2023 - April 2024",
    bullets: [
      "Oversaw a team of 6 to automate the reconciliation of case counts for infectious diseases between 50 state health departments and the CDC, alongside doubling as a full-stack software developer.",
      "Utilized Python to compare state health department and CDC data, highlighting any discrepancies between the two datasets, saving 5000+ hours of manual reconciliation annually.",
      "Leveraged React to visualize discrepancy statistics and disease-specific data, along with implementing an interactive discrepancy table filtering feature based on selected statistics.",
      "Procured feedback from CDC computer scientists and representatives from 25+ state health departments via application demonstrations and integrated the suggested modifications.",
      "Employed FastAPI to develop an endpoint for fetching discrepancy report statistics from a SQLite statistics table.",
      "Facilitated weekly team meetings, drove timely completion of tasks, ensured consistent team participation, and adhered to stringent deadlines under an agile framework.",
      "Constructed technical diagrams/documentation (Lo-Fi & Hi-Fi Prototypes, User Research, Minimum Marketable Features, Story Mapping, UX Report, and Detailed Design) to aid the development process.",
    ],
    logo: cdcLogo,
  },
  {
    id: "gt-undergraduate-teaching-assistant",
    title: "Undergraduate Teaching Assistant",
    company: "Georgia Tech College of Computing",
    location: "Atlanta, GA",
    date: "January 2023 - May 2023",
    bullets: [
      "Supervised and taught recitations for CS 3001 (Computing & Society) to 20+ students for 4+ hours per week.",
      "Evaluated assignments and exams, grading 20+ students and supplying targeted feedback to enhance performance.",
      "Fostered engagement by answering 105+ questions on Piazza, the student discussion forum.",
    ],
    logo: gtComputingLogo,
  },
]
