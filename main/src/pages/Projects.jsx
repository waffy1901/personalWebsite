import React from "react";
import ProjectCard from "../components/ProjectCard";
import cdcLogo from "../images/cdcLogo.png";
import jobSearchLogo from "../images/jobSearchLogo.png";
import campusDiscoveryServiceLogo from "../images/discoveryServiceLogo.png";

function Projects() {
  const projects = [
    {
      title: "CDC Data Reconciliation",
      techStack: "Python, FastAPI, SQLite, React, Tailwind CSS",
      bullets: [
        "Oversaw a team of 6 to automate the reconciliation of case counts for infectious diseases between 50 state health departments and the CDC, alongside doubling as a full-stack software developer.",
        "Utilized Python to compare state health department and CDC data, highlighting any discrepancies between the two datasets, saving 5000+ hours of manual reconciliation annually.",
        "Leveraged React to visualize discrepancy statistics and disease-specific data, along with implementing an interactive discrepancy table filtering feature based on selected statistics.",
        "Procured feedback from CDC computer scientists and representatives from 25+ state health departments via application demonstrations and integrated suggested modifications."
      ],
      github: "https://github.com/waffy1901/CDC-Data-Reconciliation",
      logo: cdcLogo
    },
    {
      title: "Job Search Aid",
      techStack: "Kotlin, Google Firebase, Cloud Firestore, XML, Adzuna API",
      bullets: [
        "Engineered an Android application to aid job seekers by providing resources such as FAQs, resume templates, etc.",
        "Integrated the Adzuna API using Kotlin to fetch jobs based on user preferences of job title, location, and radius.",
        "Employed FirebaseAuth to authenticate users via emails and passwords - incorporated Firestore to store germane user data, including saved jobs, usernames, emails, passwords, and names.",
      ],
      github: "https://github.com/waffy1901/jobSearchAid",
      logo: jobSearchLogo
    },
    {
      title: "Campus Discovery Service",
      techStack: "Node.js, MongoDB, Java, XML",
      bullets: [
        "Developed an Android application for students to explore and register for on-campus events at Georgia Tech, offering access to event capacities, details, and waitlists, in collaboration with 5 classmates.",
        "Constructed various technical diagrams (DCD, Domain Model, SD, SSD) to plan/design iterations of the application.",
        "Implemented secure user authentication and role-based access control, allowing event organizers and students to interact with the platform according to their permissions while protecting sensitive data."
      ],
      github: "https://github.com/waffy1901/campusDiscoveryService",
      logo: campusDiscoveryServiceLogo
    },
  ];

  return (
    <div className="bg-blue-300 min-h-screen">
      <div className="container mx-auto px-4 py-8 font-cambria">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <ProjectCard
              key={index}
              title={project.title}
              techStack={project.techStack}
              bullets={project.bullets}
              github={project.github}
              logo={project.logo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
export default Projects;