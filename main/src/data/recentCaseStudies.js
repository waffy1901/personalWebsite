import { recentCaseStudySummaries } from "./recentCaseStudySummaries.js"

// Public narratives use owner-reported facts. Examples describe concepts and are
// deliberately illustrative, not copies of employer configuration or runbooks.
export const recentCaseStudies = [
  {
    ...recentCaseStudySummaries[0],
    flow: [
      { title: "Move execution", detail: "Replace laptop execution and human credentials with a scheduled GKE workload." },
      { title: "Adapt data access", detail: "Move from Cloud SQL to Spanner through an in-container PGAdapter and resolve cross-project access." },
      { title: "Validate and repair", detail: "Progress from dry-run to writes, then investigate production sequencing and queue behavior." },
    ],
    sections: [
      { heading: "Problem and ownership", paragraphs: [
        "Internal order reconciliation depended on developer-run scripts, database tunnels, and human GCP credentials. A recurring business workflow needed an operational execution path rather than a person's laptop. This system is separate from the public CDC case-count reconciliation application.",
        "I productionized the workload with cdk8s Job/CronJob definitions, Terraform, and Spinnaker, implemented its workload identity and secret access, adapted the database integration, and addressed subsequent production defects. My ownership covered the workflow and its integration with dependent platforms.",
      ] },
      { heading: "Decisions and constraints", paragraphs: [
        "Moving execution to GKE changed both scheduling and the identity boundary. Workload Identity, least-privilege IAM, and Google Secret Manager/External Secrets replaced dependence on human credentials for this workflow.",
        "The database target changed from Cloud SQL to Cloud Spanner mid-migration. The PGAdapter sidecar option was blocked, so I placed PGAdapter inside the application container. This preserved the required database compatibility path within the deployment constraint, at the cost of coupling adapter lifecycle to the application container.",
        "Cross-project BigQuery IAM was another independent access boundary to resolve. A running container or successful Spanner connection alone could not establish that the complete reconciliation workflow had the required data access.",
      ] },
      { heading: "Validation, failure, and recovery", paragraphs: [
        "Production validation progressed through dry-run, single-order, and full-write execution. These stages separated basic access and comparison checks from the consequences of broader writes.",
        "Production aftercare exposed different failure modes: a September sequencing race with the Elasticsearch gap report, followed by an October queue defect affecting batches larger than 100 items. I addressed those failures. Once items were released from initial and maxed_out states, normal processing reprocessed the approximately 2,200-item backlog. That is recovery evidence for this incident, not a guarantee about every future run.",
      ] },
      { heading: "Outcome and limits", paragraphs: [
        "The owner reports seven scheduled executions per week and estimates approximately 120 engineer-hours of recurring toil saved annually. The underlying per-run timing and annualization calculation have not been validated for this public account, so the estimate is not a measured productivity result.",
        "The engineering lesson was to validate orchestration and queue boundaries alongside the database migration. For a future iteration, I would document representative batch sizes and dependency ordering as explicit acceptance checks. That is a proposed improvement, not a claim about tests that existed during the migration.",
      ] },
    ],
    causalDiagram: {
      afterSection: "Decisions and constraints",
      title: "Execution and data-access boundaries",
      sequenceLabel: "Order reconciliation execution sequence",
      description: "Sanitized conceptual sequence. Each boundary can fail independently; the list is an accessible text equivalent of the workflow.",
      steps: [
        { title: "Scheduled workload", detail: "A cdk8s-defined Job/CronJob moves execution onto GKE.", relationship: "Execution requires workload access" },
        { title: "Workload identity and secrets", detail: "Workload Identity, scoped IAM, and managed secrets support non-human execution.", relationship: "Authorized execution reaches data dependencies" },
        { title: "Database and reporting access", detail: "In-container PGAdapter supports the Spanner path; cross-project BigQuery access is separately required.", relationship: "Data access enables reconciliation" },
        { title: "Reconciliation and queue processing", detail: "Report sequencing and batch handling affect whether work can complete." },
      ],
      feedback: "Dry-run, single-order, and full-write validation provide different evidence. Later report and queue failures showed why connectivity alone was insufficient.",
    },
    configurationExample: {
      afterSection: "Validation, failure, and recovery",
      title: "Illustrative validation record",
      description: "Sanitized checklist based on the reported stages and failures. This is an explanatory artifact, not a historical log, executable configuration, or recovery runbook.",
      examples: [
        { title: "Stages and evidence", code: "dry-run -> inspect comparison output\nsingle-order -> inspect one write path\nfull-write -> inspect broader execution" },
        { title: "Failure boundaries to inspect", code: "report dependency -> sequencing\nbatch > 100 items -> queue handling\ninitial / maxed_out -> backlog state" },
      ],
    },
    stack: ["GKE", "cdk8s", "Terraform", "Spinnaker", "Cloud Spanner", "PGAdapter", "BigQuery", "Workload Identity", "Secret Manager / External Secrets"],
    links: [{ label: "Read CI credential lifecycle", to: "/case-studies/jfrog-oidc-adoption/" }, { label: "View reconciliation aftercare", to: "/experience/#order-reconciliation-aftercare" }],
  },
  {
    ...recentCaseStudySummaries[1],
    flow: [
      { title: "Repair release inputs", detail: "Modernize frameworks, containers, and build behavior across the service estate." },
      { title: "Validate changes", detail: "Use staged validation to distinguish security findings from delivery failures." },
      { title: "Restore delivery", detail: "Recover release paths that had been blocked for roughly 11 months." },
    ],
    sections: [
      { heading: "Problem and ownership", paragraphs: [
        "Security remediation was entangled with unhealthy delivery paths across approximately 15 booking services. Framework, container, and pipeline changes had to produce usable release builds; fixing a dependency finding alone would not restore a blocked release path.",
        "I directly remediated 10 services and assisted with five others during September-October 2026. The work included Spring Boot and Quarkus modernization, container and build changes, code/SAST remediation, and pipeline recovery. The direct and assisted contributions reflect different levels of implementation ownership.",
      ] },
      { heading: "Decision and tradeoff", paragraphs: [
        "The alternative was to seek security exceptions. I chose to fix the underlying framework, container, and delivery problems so the release path could pass its gates through remediation. That choice does not mean an exception was requested or granted. Framework and container changes can remove vulnerable build inputs while also introducing compatibility failures, so validation had to cover both security and delivery.",
        "The consequential tradeoff was the additional validation burden of changing several layers in an estate with already-blocked releases. Compatibility checks mattered alongside vulnerability results because the change had to recover delivery as well as improve the release inputs.",
      ] },
      { heading: "Verification and recovery", paragraphs: [
        "Changes went through staged validation, and PR scanning was added across seven applications. Release-build vulnerability results, code/SAST findings, and build-gate status provided distinct evidence. The failure mode to guard against was a cleaner scan paired with an application or pipeline that could no longer release.",
        "Release paths blocked for roughly 11 months were restored. The supported security result concerns release builds; deployed-image remediation requires its own runtime evidence.",
      ] },
      { heading: "Outcome and lesson", paragraphs: [
        "The reported result was removal of 66 unique critical/high CVE IDs from release builds and remediation of 16 code/SAST findings, including four critical findings. The owner confirmed a final 100% build-gate pass across approximately 15 services, compared with the earlier reported 33%. Exact observation dates and a build-attempt denominator are unavailable; this is an owner-reported service-estate result.",
        "My lesson was to keep security and delivery evidence separate while solving them together. In future reporting, I would retain per-service before/after build artifacts and exact observation windows to distinguish release-build remediation, gate recovery, and deployed-runtime status.",
      ] },
    ],
    causalDiagram: {
      afterSection: "Decision and tradeoff",
      title: "From remediation to a usable release path",
      sequenceLabel: "Security and delivery validation sequence",
      description: "A conceptual evidence chain, not a claim that every service had identical pipeline stages.",
      steps: [
        { title: "Framework and container inputs", detail: "Spring Boot, Quarkus, container, and build modernization change the release inputs.", relationship: "Changed inputs require compatibility evidence" },
        { title: "Staged validation and scanning", detail: "Build behavior, release-build CVEs, and code/SAST findings require separate checks.", relationship: "Validation supports release-path recovery" },
        { title: "Restored release path", detail: "A passing build gate supports delivery; deployed runtime remediation requires further evidence." },
      ],
      feedback: "Scan success is not interchangeable with a deployable application or verification of every running production image.",
    },
    configurationExample: {
      afterSection: "Verification and recovery",
      title: "Illustrative evidence ledger",
      description: "Sanitized conceptual ledger separating the reported result types. This is not an internal scanner export or a per-service historical record.",
      examples: [
        { title: "Security evidence", code: "release builds: 66 unique critical/high CVE IDs removed\ncode/SAST: 16 findings, including 4 critical\nPR scanning: added across 7 applications" },
        { title: "Delivery evidence", code: "contribution: 10 services direct + 5 assisted\nfinal build-gate pass: owner-reported 100%\nrunning production images: not established here" },
      ],
    },
    stack: ["Java", "Spring Boot", "Quarkus", "Docker", "CI/CD", "SAST", "PR scanning"],
    links: [{ label: "Read legacy deployment recovery", to: "/case-studies/legacy-deployment-recovery/" }, { label: "Read CI credential lifecycle", to: "/case-studies/jfrog-oidc-adoption/" }, { label: "View related experience", to: "/experience/" }],
  },
  {
    ...recentCaseStudySummaries[2],
    flow: [
      { title: "Trace the system", detail: "Connect code and configuration with BigQuery and store telemetry." },
      { title: "Ground findings", detail: "Use historical baselines, citations, coverage checks, and false-finding suppression." },
      { title: "Transfer ownership", detail: "Validate with stakeholders, provide knowledge transfer, and hand off for active use." },
    ],
    sections: [
      { heading: "Problem and ownership", paragraphs: [
        "Payment triage spanned seven applications and required investigation across code, configuration, BigQuery, and store telemetry. An explanation needed traceable evidence and enough coverage to avoid turning a plausible narrative into an unsupported finding.",
        "The ask was to extend an existing skill/router. I led a four-person team, including myself, from design through stakeholder validation and handoff of that extension. I implemented a little over half of the tool; three other engineers contributed. I provided knowledge transfer and handoff to the operations and receiving teams. The receiving team now owns the tool and actively uses it.",
      ] },
      { heading: "Decision and tradeoff", paragraphs: [
        "Within that extension, the central design choice was to ground AI-assisted findings in code/config tracing, queried telemetry, historical baselines, and evidence citations. Coverage checks and false-finding suppression constrained what the tool should present. Making findings inspectable also made evidence collection and missing coverage part of the product's work.",
        "Historical baselines provide context; they do not establish causality by themselves. Citations help a reviewer inspect support, but a citation is not proof that an interpretation is correct. The supported scope is cited evidence for human investigation. This operational triage tool is separate from the Jira-to-GKE hackathon delivery prototype.",
      ] },
      { heading: "Validation and failure modes", paragraphs: [
        "Stakeholder validation, coverage checks, and suppression of false findings were part of the work. Relevant failure modes include missing evidence, incomplete application coverage, a misleading baseline comparison, and a confident explanation that outruns its cited support. Those limits are why evidence quality belongs in the investigation flow rather than being an afterthought.",
        "No reliable accuracy percentage or causal productivity measurement is available for this account. The evidence supports an evaluation approach and operational handoff, rather than numerical effectiveness. Examples below use placeholders to protect internal investigation data.",
      ] },
      { heading: "Outcome and lesson", paragraphs: [
        "The supported outcome is delivery through stakeholder validation, knowledge transfer, and handoff, followed by active use and ownership by the receiving team. That establishes operational adoption; it does not demonstrate that every suggestion is correct or that triage time fell by a measured amount.",
        "My lesson was to treat implementation, evidence quality, and operational ownership as one delivery responsibility. A future evaluation should preserve representative reviewed cases, coverage gaps, and incorrect findings so usefulness can be measured. That is a recommendation, not a claim that a benchmark already exists.",
      ] },
    ],
    causalDiagram: {
      afterSection: "Decision and tradeoff",
      title: "An inspectable triage finding",
      sequenceLabel: "Payment triage evidence sequence",
      description: "Sanitized conceptual view of evidence grounding. The ordered text describes the boundaries without exposing internal data.",
      steps: [
        { title: "Code, configuration, and telemetry", detail: "Tracing, BigQuery, and store telemetry provide investigation context.", relationship: "Source context supports comparison" },
        { title: "Baseline and coverage checks", detail: "Historical comparison and coverage checks help identify gaps and suppress false findings.", relationship: "Checked evidence supports a reviewable finding" },
        { title: "Cited finding for human investigation", detail: "Evidence citations let the receiving engineer inspect the basis for a suggestion." },
      ],
      feedback: "Missing coverage or weak support must remain visible to the investigator. Human judgment remains necessary even when a finding includes citations.",
    },
    configurationExample: {
      afterSection: "Validation and failure modes",
      title: "Illustrative finding review card",
      description: "Invented placeholders demonstrate evidence organization only. This is not an actual payment incident, tool output, evaluation result, or internal schema.",
      examples: [
        { title: "Evidence to inspect", code: "observation: [sanitized telemetry summary]\ncode/config support: [source reference]\nbaseline: [comparison context]\ncoverage: [known gaps]" },
        { title: "Human review boundary", code: "candidate explanation: [reviewable hypothesis]\ncitations: [supporting references]\nreview: inspect support and missing coverage\nnext step: human investigation" },
      ],
    },
    stack: ["AI-assisted investigation", "Code and configuration tracing", "BigQuery", "Store telemetry", "Historical baselines", "Evidence citations", "Knowledge transfer"],
    links: [{ label: "View technical guidance", to: "/experience/#infrastructure-guidance" }, { label: "Explore the separate delivery prototype", to: "/projects/#jira-to-gke-hackathon" }],
  },
  {
    ...recentCaseStudySummaries[3],
    flow: [
      { title: "Identify exposure", detail: "Shared credentials and plaintext token output created a CI credential-lifecycle problem." },
      { title: "Adapt authentication", detail: "Use short-lived job-scoped Maven/Docker authentication through JFrog OIDC." },
      { title: "Verify adoption", detail: "Validate pipeline authentication in stages across the repository estate." },
    ],
    sections: [
      { heading: "Problem and ownership", paragraphs: [
        "Shared Maven and Docker credentials crossed repository and job boundaries. The owner reported plaintext token output in CI logs across approximately 20 repositories, linked to more than 1,100 scanning findings. The finding count describes scanner results, not 1,100 distinct leaked secrets.",
        "I drove JFrog OIDC adoption across two teams in October 2026, including CI pipeline adaptations for short-lived, job-scoped authentication. My role was to drive that cross-team change; participating repository work was shared.",
      ] },
      { heading: "Decision and trust boundary", paragraphs: [
        "The alternative I considered was a service account and password with custom masking. I chose OIDC and short-lived job-scoped tokens: masking addresses output handling, while job identity and temporary authentication also change how credentials are distributed and how long they remain usable. This made the identity-to-access boundary part of pipeline reliability.",
        "The tradeoff is that artifact operations now depend on the OIDC exchange and its trust configuration. A failed exchange can block a build even when the application code is healthy. The public account omits private issuer, audience, subject, trust-policy, permission, and token-lifetime settings; the diagram illustrates the boundary without supplying deployable provider configuration.",
      ] },
      { heading: "Verification and recovery limits", paragraphs: [
        "The work included CI adaptations and staged verification of Maven/Docker authentication. Authentication and artifact-operation checks serve different purposes: accepting an identity is not, by itself, evidence that the job can complete its required artifact operation. Short-lived tokens also do not make printing tokens safe.",
        "A future rollout should document recovery from a failed exchange without reintroducing shared secrets or logging token material. That is a recommended improvement; the historical recovery procedure is not documented here.",
      ] },
      { heading: "Outcome and lesson", paragraphs: [
        "The owner reports adoption across two teams and approximately 20 repositories, replacing shared credentials with short-lived, job-scoped tokens and resolving more than 1,100 findings tied to plaintext token output in CI logs. The scan tool, observation window, and deduplication method are unspecified; the finding count is not a distinct-secret count or a numerical measure of risk reduction.",
        "I was the first to adopt this approach within my engineering organization and established it as the standard there. I reinforced that direction in a later engineer's migration PR review, explaining the implementation already in place and the rationale before approving. The reported implementation scope remains two teams and approximately 20 repositories; this is not a company-wide standard claim.",
        "The lesson was to treat credential lifetime, job identity, pipeline usability, and logging behavior as related boundaries. A future evidence package should preserve redacted artifact-operation results and repeatable scan definitions so adoption and exposure reduction can be assessed independently.",
      ] },
    ],
    causalDiagram: {
      afterSection: "Decision and trust boundary",
      title: "Job identity to artifact access",
      sequenceLabel: "CI authentication trust sequence",
      description: "Illustrative trust sequence only. Internal provider policies, permission values, and exchange endpoints are intentionally omitted.",
      steps: [
        { title: "CI job identity", detail: "A job presents identity for an OIDC-based authentication flow.", relationship: "Identity is evaluated at the trust boundary" },
        { title: "JFrog authentication boundary", detail: "Trust configuration determines whether the identity can obtain artifact access.", relationship: "Accepted identity enables scoped authentication" },
        { title: "Short-lived job token", detail: "The job uses temporary authentication for its Maven or Docker artifact operations." },
      ],
      feedback: "An accepted exchange, a successful artifact operation, and absence of plaintext token output are separate verification concerns.",
    },
    configurationExample: {
      afterSection: "Verification and recovery limits",
      title: "Illustrative credential-boundary checklist",
      description: "Conceptual review aid, not JFrog API syntax, internal CI configuration, or a historical test log. It contains no usable credentials or policy values.",
      examples: [
        { title: "Authentication and use", code: "job identity -> trust evaluation\naccepted exchange -> short-lived job token\njob token -> Maven / Docker operation" },
        { title: "Separate evidence questions", code: "Can the intended job authenticate?\nCan its artifact operation complete?\nDoes output avoid plaintext token material?\nWhat does each scanner finding count?" },
      ],
    },
    stack: ["JFrog", "OIDC", "Maven", "Docker", "CI/CD", "Short-lived credentials"],
    links: [{ label: "Read booking release recovery", to: "/case-studies/booking-security-cicd-recovery/" }, { label: "View related experience", to: "/experience/" }],
  },
]
