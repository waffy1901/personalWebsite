export const resumeDocument = {
  title: "Waffy Ahmed Resume",
  language: "en-US",
  name: "Waffy Ahmed",
  contact: [
    { label: "Phone", text: "404-740-7870", href: "tel:+14047407870" },
    { label: "Email", text: "waffyahmed@gmail.com", href: "mailto:waffyahmed@gmail.com" },
    { label: "LinkedIn", text: "linkedin.com/in/wa24", href: "https://www.linkedin.com/in/wa24/" },
    { label: "Portfolio", text: "waffy.dev", href: "https://waffy.dev/" },
  ],
  education: [
    {
      institution: "Georgia Institute of Technology",
      location: "Atlanta, GA",
      date: "December 2024",
      degree: "Bachelor of Science in Computer Science",
      honors: "Faculty Honors, Dean's List, Zell Miller Scholar",
    },
  ],
  experience: [
    {
      company: "The Home Depot",
      location: "Atlanta, GA",
      roles: [
        {
          title: "Software Engineer II",
          date: "July 2026 - Present",
          bullets: [
            "Productionized daily order reconciliation, replacing laptop scripts, database tunnels, and human GCP credentials with a Kubernetes workflow via cdk8s, Terraform, and Spinnaker; implemented Workload Identity, least-privilege IAM, and Secret Manager/External Secrets, eliminating human production access.",
            "Re-architected order reconciliation from Cloud SQL to Cloud Spanner mid-migration, engineering an in-container PGAdapter, resolving cross-project IAM blockers, and hardening failure paths via staged production validation; automated 7 weekly runs via Kubernetes CronJob, eliminating ~120 engineer-hours of recurring toil annually.",
          ],
        },
        {
          title: "Software Engineer I",
          date: "January 2025 - July 2026",
          bullets: [
            "Increased system resilience by implementing Kubernetes Horizontal Pod Autoscaling (HPA) for a core service previously capped at 20 static pods, reducing mean latency from 121 to 72 ms and error rates by 89% while increasing throughput from 24.9M to 34.8M requests/week and enabling dynamic scaling up to 100 pods.",
            "Reconstructed deployment workflows for legacy Java 1.8 Tomcat services lacking operational ownership by rebuilding CI/CD pipelines and enabling zero-downtime Cassandra credential rotation, eliminating a platform outage risk capable of halting all transaction capture.",
            "Remediated ~330 OS-level and Python CVEs across 13 microservices by migrating Docker builds from UBI8 to a minimal internal Artifactory base image, reverse-engineering undocumented build processes and resolving CI/CD 401 authentication failures to enable secure, reproducible container builds.",
            "Led testing and validation to disable a legacy service component handling ~27% of transaction volume (14.5 million daily captures/lookups) using BigQuery and Postman, supporting a phased retirement effort involving 12 teams.",
            "Reduced mean time to recovery ~50% by implementing an automated Kubernetes rolling-restart job for 20+ microservices, replacing slow Argo Rollouts and accelerating recovery from memory-leak/state-drift issues.",
          ],
        },
        {
          title: "Software Engineer Intern",
          date: "May 2023 - July 2023, May 2024 - July 2024",
          bullets: [
            "Developed an internal product information page for cashiers, streamlining self-checkout processes and reducing customer wait times for associate interventions by ~25%.",
            "Leveraged Java, React, and TypeScript to retrieve and surface validated product data across all self-checkout registers, mitigating customer theft by ~$750,000 annually.",
            "Optimized the efficiency of configuring 40,000+ registers across 2,300 stores by 90%, in collaboration with 2 interns.",
            "Truncated maximum deployment time for register updates from 24+ hours to 30 minutes by using Java HttpClient and Flow APIs to streamline retrieval of polymorphic external configurations.",
          ],
        },
      ],
    },
  ],
  projects: [
    {
      name: "Fintech @ Georgia Tech",
      technologies: "React, React Native, TypeScript, Stripe API, Chakra UI",
      bullets: [
        "Reduced page load times by ~35% via transforming a multi-page credit card website into a React-based single-page application, streamlining card wallet management and adding a card removal feature for authenticated users.",
        "Implemented a cart page for a React Native grocery application, allowing users to add/remove items, adjust quantities, view real-time total costs, and integrated the Stripe API for streamlined in-app credit card payments.",
      ],
    },
    {
      name: "CDC Data Reconciliation",
      technologies: "Python, FastAPI, SQLite, React, Tailwind CSS",
      bullets: [
        "Led a team of 6 to automate the reconciliation of case counts for infectious diseases between 50 state health departments and the CDC, alongside doubling as a full-stack software developer.",
        "Utilized Python to compare state health department and CDC data, highlighting any discrepancies between the two datasets, saving 5000+ hours of manual reconciliation annually.",
      ],
    },
  ],
  skills: [
    { label: "Programming Languages", value: "Java, Python, JavaScript, TypeScript, SQL" },
    { label: "Technologies/Frameworks", value: "Kubernetes, Google Cloud Platform (GCP), Terraform, cdk8s, Docker, Cloud Spanner, Cassandra, Elasticsearch, BigQuery, Grafana, Prometheus, OpenTelemetry, React, FastAPI, Node.js, JUnit, Git" },
    { label: "Concepts", value: "Object-Oriented Programming & Design, Test-Driven Development, NoSQL, Data Structures & Algorithms, Full-Stack, CI/CD, Infrastructure, Distributed Systems, Cloud Computing, Microservices Architecture" },
  ],
}
