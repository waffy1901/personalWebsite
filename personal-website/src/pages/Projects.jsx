import React from "react"
import ProjectCard from "../components/ProjectCard"

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
      github: "https://github.com/waffy1901/CDC-Data-Reconciliation"
    },
    {
      title: "Job Search Aid",
      techStack: "Kotlin, Google Firebase, Cloud Firestore, XML, Adzuna API",
      bullets: [
        "Engineered an Android application to aid job seekers by providing resources such as FAQs, resume templates, etc.",
        "Integrated the Adzuna API using Kotlin to fetch jobs based on user preferences of job title, location, and radius.",
        "Employed FirebaseAuth to authenticate users via emails and passwords - incorporated Firestore to store germane user data, including saved jobs, usernames, emails, passwords, and names.",
      ],
      github: "https://github.com/waffy1901/jobSearchAid"
    },
    {
      title: "Campus Discovery Service",
      techStack: "Node.js, MongoDB, Java, XML",
      bullets: [
        "Developed an Android application for students to explore and register for on-campus events at Georgia Tech, offering access to event capacities, details, and waitlists, in collaboration with 5 classmates.",
      ],
      github: "https://github.com/waffy1901/campusDiscoveryService"
    },
  ]

  return (
    <div className="bg-blue-300 min-h-screen">
    <div className="container mx-auto px-4 py-8 font-cambria">
      <div className="flex flex-col items-center">
        <div className="flex flex-col md:flex-row justify-center items-start gap-8 w-full mb-8">
          {projects.slice(0, 2).map((project, index) => (
            <div key={index} className="w-full md:w-[40%]">
              <ProjectCard
                title={project.title}
                techStack={project.techStack}
                bullets={project.bullets}
                github={project.github}
              />
            </div>
          ))}
        </div>
        <div className="w-full md:w-[40%]">
          <ProjectCard
            title={projects[2].title}
            techStack={projects[2].techStack}
            bullets={projects[2].bullets}
            github={projects[2].github}
          />
        </div>
      </div>
    </div>
    </div>
  )
}
export default Projects