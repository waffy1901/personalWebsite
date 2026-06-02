import cdcLogo from "../images/cdcLogo.png"
import campusDiscoveryServiceLogo from "../images/discoveryServiceLogo.png"
import jobSearchLogo from "../images/jobSearchLogo.png"

export const projectsPage = {
  title: "Practical builds for real workflows",
  description:
    "Public health reconciliation, job search support, and campus discovery tools built with full-stack and mobile-first thinking.",
}

export const projectStats = [
  {
    id: "repos",
    icon: "branch",
    value: "3",
    label: "Repos",
  },
  {
    id: "data-apps",
    icon: "database",
    value: "2",
    label: "Data Apps",
  },
  {
    id: "mobile",
    icon: "mobile",
    value: "2",
    label: "Mobile",
  },
]

export const projects = [
  {
    id: "cdc-data-reconciliation",
    title: "CDC Data Reconciliation",
    techStack: "Python, FastAPI, SQLite, React, Tailwind CSS",
    bullets: [
      "Oversaw a team of 6 to automate the reconciliation of case counts for infectious diseases between 50 state health departments and the CDC, alongside doubling as a full-stack software developer.",
      "Utilized Python to compare state health department and CDC data, highlighting any discrepancies between the two datasets, saving 5000+ hours of manual reconciliation annually.",
      "Leveraged React to visualize discrepancy statistics and disease-specific data, along with implementing an interactive discrepancy table filtering feature based on selected statistics.",
      "Procured feedback from CDC computer scientists and representatives from 25+ state health departments via application demonstrations and integrated suggested modifications.",
    ],
    github: "https://github.com/waffy1901/CDC-Data-Reconciliation",
    logo: cdcLogo,
  },
  {
    id: "job-search-aid",
    title: "Job Search Aid",
    techStack: "Kotlin, Google Firebase, Cloud Firestore, XML, Adzuna API",
    bullets: [
      "Engineered an Android application to aid job seekers by providing resources such as FAQs, resume templates, etc.",
      "Integrated the Adzuna API using Kotlin to fetch jobs based on user preferences of job title, location, and radius.",
      "Employed FirebaseAuth to authenticate users via emails and passwords - incorporated Firestore to store germane user data, including saved jobs, usernames, emails, passwords, and names.",
    ],
    github: "https://github.com/waffy1901/jobSearchAid",
    logo: jobSearchLogo,
  },
  {
    id: "campus-discovery-service",
    title: "Campus Discovery Service",
    techStack: "Node.js, MongoDB, Java, XML",
    bullets: [
      "Developed an Android application for students to explore and register for on-campus events at Georgia Tech, offering access to event capacities, details, and waitlists, in collaboration with 5 classmates.",
      "Constructed various technical diagrams (DCD, Domain Model, SD, SSD) to plan/design iterations of the application.",
      "Implemented secure user authentication and role-based access control, allowing event organizers and students to interact with the platform according to their permissions while protecting sensitive data.",
    ],
    github: "https://github.com/waffy1901/campusDiscoveryService",
    logo: campusDiscoveryServiceLogo,
  },
]
