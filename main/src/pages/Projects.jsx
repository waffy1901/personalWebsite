import React from "react";
import { FaCodeBranch, FaDatabase, FaMobileAlt } from "react-icons/fa";
import ProjectCard from "../components/ProjectCard";
import { projectStats, projects, projectsPage } from "../data/projects";

const statIconById = {
  branch: FaCodeBranch,
  database: FaDatabase,
  mobile: FaMobileAlt,
};

function Projects() {
  return (
    <div className="bg-blue-300 min-h-screen">
      <div className="container mx-auto px-4 py-8 font-cambria">
        <header className="mx-auto mb-10 max-w-6xl">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="relative pl-5">
              <span className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-1 rounded bg-blue-800" />
              <h1 className="max-w-3xl text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
                {projectsPage.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-700">
                {projectsPage.description}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-gray-800 md:min-w-[18rem]">
              {projectStats.map((stat) => {
                const Icon = statIconById[stat.icon];
                return (
                  <div key={stat.id} className="px-2">
                    <Icon className="mx-auto mb-2 text-blue-800" />
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
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
