import reference from "./resume-layout-reference.json" with { type: "json" }

export const resumeLayout = reference

// Typography equivalents only. Never discard words or punctuation to make a
// changed resume pass the fixed print-layout contract.
export const normalizeResumeText = (text) => String(text).normalize("NFKC")
  .replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/[\u223c\u2248]/g, "~")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\s+/g, " ")
  .trim()

export function resumePrintLines(key, text) {
  const lines = resumeLayout.paragraphs[key]
  if (!lines) throw new Error(`Missing resume print layout: ${key}`)
  if (normalizeResumeText(lines.map((line) => line.text).join(" ")) !== normalizeResumeText(text)) {
    throw new Error(`Resume content changed at ${key}; review its line breaks against the approved PDF before regenerating`)
  }
  return lines
}

export function validateResumeLayout(document) {
  const keys = []
  document.experience.forEach((employer, employerIndex) => employer.roles.forEach((role, roleIndex) => {
    role.bullets.forEach((text, bulletIndex) => {
      const key = `experience.${employerIndex}.roles.${roleIndex}.bullets.${bulletIndex}`
      resumePrintLines(key, text)
      keys.push(key)
    })
  }))
  document.projects.forEach((project, projectIndex) => project.bullets.forEach((text, bulletIndex) => {
    const key = `projects.${projectIndex}.bullets.${bulletIndex}`
    resumePrintLines(key, text)
    keys.push(key)
  }))
  document.skills.forEach((skill, index) => {
    const key = `skills.${index}`
    resumePrintLines(key, `${skill.label}: ${skill.value}`)
    keys.push(key)
  })
  if (keys.length !== Object.keys(resumeLayout.paragraphs).length) {
    throw new Error("Resume paragraph count changed; review the print layout before regenerating")
  }
}
