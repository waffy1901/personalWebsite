import React from "react"
import { resumeDocument } from "../data/resume.mjs"

function ResumeDocument() {
  return (
    <article aria-labelledby="resume-document-heading" className="text-[#0B1220]">
      <header className="border-b border-slate-200 pb-5 text-center">
        <h2 id="resume-document-heading" className="text-3xl font-black sm:text-4xl">
          {resumeDocument.name}
        </h2>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-bold text-slate-700" aria-label="Contact information">
          {resumeDocument.contact.map((contact) => (
            <li key={contact.label}>
              <a href={contact.href} className="underline decoration-[#2563EB]/50 underline-offset-4 hover:text-[#1D4ED8] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2">
                <span className="sr-only">{contact.label}: </span>{contact.text}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="resume-education-heading" className="mt-6">
        <h3 id="resume-education-heading" className="text-xl font-black">Education</h3>
        {resumeDocument.education.map((education) => (
          <div key={education.institution} className="mt-3 rounded-md bg-slate-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="font-black">{education.institution} <span className="font-medium text-slate-600">| {education.location}</span></p>
              <p className="shrink-0 text-sm font-bold text-slate-700">{education.date}</p>
            </div>
            <p className="mt-1 text-sm font-semibold">{education.degree}</p>
            <p className="mt-1 text-sm text-slate-600">{education.honors}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="resume-experience-heading" className="mt-7">
        <h3 id="resume-experience-heading" className="text-xl font-black">Experience</h3>
        {resumeDocument.experience.map((employer) => (
          <div key={employer.company} className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="font-black">{employer.company}</p>
              <p className="text-sm font-bold text-slate-700">{employer.location}</p>
            </div>
            {employer.roles.map((role) => (
              <section key={`${employer.company}-${role.title}`} className="mt-3" aria-label={`${role.title} at ${employer.company}`}>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h4 className="font-bold italic">{role.title}</h4>
                  <p className="text-sm font-semibold text-slate-700">{role.date}</p>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                  {role.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="resume-projects-heading" className="mt-7">
        <h3 id="resume-projects-heading" className="text-xl font-black">Projects</h3>
        {resumeDocument.projects.map((project) => (
          <section key={project.name} className="mt-4" aria-label={project.name}>
            <h4 className="font-black">{project.name} <span className="font-medium italic text-slate-600">| {project.technologies}</span></h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              {project.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </section>
        ))}
      </section>

      <section aria-labelledby="resume-skills-heading" className="mt-7">
        <h3 id="resume-skills-heading" className="text-xl font-black">Skills</h3>
        <dl className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          {resumeDocument.skills.map((skill) => <div key={skill.label}><dt className="inline font-black text-[#0B1220]">{skill.label}: </dt><dd className="inline">{skill.value}</dd></div>)}
        </dl>
      </section>
    </article>
  )
}

export default ResumeDocument
