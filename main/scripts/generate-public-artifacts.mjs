#!/usr/bin/env node
import crypto from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, "..")
const repoRoot = path.resolve(appRoot, "..")
const checkOnly = process.argv.includes("--check")

const GENERATED_START = "<!-- generated-public-docs:start -->"
const GENERATED_END = "<!-- generated-public-docs:end -->"

const readText = (relPath) => readFile(path.join(repoRoot, relPath), "utf8")
const readJson = async (relPath) => JSON.parse(await readText(relPath))

const toRelativePath = (absolutePath) => path.relative(repoRoot, absolutePath)

const splitCsv = (value) =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

const packageVersion = (packageJson, packageName) => {
  const rawVersion =
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    ""
  const numericVersion = rawVersion.match(/\d+(?:\.\d+)*/)

  return numericVersion ? numericVersion[0] : rawVersion
}

const packageMajor = (packageJson, packageName) =>
  packageVersion(packageJson, packageName).split(".")[0]

const titleWithoutSuffix = (title) =>
  title.replace(" | Waffy Ahmed", "").replace("Waffy Ahmed | ", "")

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

const wrapText = (
  text,
  { width = 78, indent = "", subsequentIndent = indent } = {}
) => {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let current = indent.trimEnd()

  for (const word of words) {
    const next = current.trim() ? `${current} ${word}` : `${current}${word}`
    if (next.length > width && current.trim()) {
      lines.push(current)
      current = `${subsequentIndent}${word}`
    } else {
      current = next
    }
  }

  if (current.trim()) lines.push(current)

  return lines
}

const bullet = (text) =>
  wrapText(text, { indent: "* ", subsequentIndent: "  " })

const numbered = (index, text) =>
  wrapText(text, {
    indent: `${index + 1}. `,
    subsequentIndent: "   ",
  })

const markdownLink = (label, url) => `[${label}](${url})`

const upsertGeneratedBlock = (content, body, insertionAnchor) => {
  const block = `${GENERATED_START}\n${body.trimEnd()}\n${GENERATED_END}`
  const startIndex = content.indexOf(GENERATED_START)
  const endIndex = content.indexOf(GENERATED_END)

  if (startIndex !== -1 || endIndex !== -1) {
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      throw new Error("Generated README markers are unbalanced")
    }

    return `${content.slice(0, startIndex)}${block}${content.slice(
      endIndex + GENERATED_END.length
    )}`
  }

  const anchorIndex = content.indexOf(insertionAnchor)
  if (anchorIndex === -1) {
    throw new Error(`Missing README insertion anchor: ${insertionAnchor}`)
  }

  const insertionIndex = anchorIndex + insertionAnchor.length

  return `${content.slice(0, insertionIndex)}\n\n${block}${content.slice(
    insertionIndex
  )}`
}

const updateJsonLdScript = (html, scriptText) => {
  const pattern =
    /(<script id="portfolio-jsonld" type="application\/ld\+json">)([\s\S]*?)(<\/script>)/

  if (!pattern.test(html)) {
    throw new Error("Missing #portfolio-jsonld script in main/index.html")
  }

  return html.replace(pattern, (_match, open, _body, close) => {
    return `${open}${scriptText}${close}`
  })
}

const updateCspHash = (toml, hashToken) => {
  const pattern = /'sha256-[^']+'/

  if (!pattern.test(toml)) {
    throw new Error("Missing CSP SHA-256 token in netlify.toml")
  }

  return toml.replace(pattern, `'${hashToken}'`)
}

const metricLabel = (metric) => `${metric.value} ${metric.label}`

const routePriority = (routePath) => {
  if (routePath === "/") return "1.0"
  if (routePath === "/case-studies") return "0.9"
  if (routePath === "/resume") return "0.7"
  if (routePath === "/contact") return "0.6"
  return "0.8"
}

const publicResourcePriority = () => "0.5"

const loadCanonicalModules = async () => {
  const server = await createServer({
    root: appRoot,
    logLevel: "error",
    server: {
      middlewareMode: true,
      ws: false,
    },
    appType: "custom",
  })

  try {
    const [
      profileModule,
      experienceModule,
      projectsModule,
      caseStudiesModule,
      seoModule,
      publicPortfolioModule,
    ] = await Promise.all([
      server.ssrLoadModule("/src/data/profile.js"),
      server.ssrLoadModule("/src/data/experience.js"),
      server.ssrLoadModule("/src/data/projects.js"),
      server.ssrLoadModule("/src/data/caseStudies.js"),
      server.ssrLoadModule("/src/data/seo.js"),
      server.ssrLoadModule("/src/data/publicPortfolio.js"),
    ])

    return {
      ...profileModule,
      ...experienceModule,
      ...projectsModule,
      ...caseStudiesModule,
      ...seoModule,
      ...publicPortfolioModule,
    }
  } finally {
    await server.close()
  }
}

const buildStructuredPortfolio = (model) => {
  const {
    caseStudies,
    projects,
    publicPortfolio,
    resume,
    socialLinks,
    profile,
    toAbsoluteUrl,
  } = model
  const socialById = Object.fromEntries(
    socialLinks.map((link) => [link.id, link.href])
  )

  return {
    schemaVersion: publicPortfolio.schemaVersion,
    contentLastReviewed: publicPortfolio.contentLastReviewed,
    person: {
      name: profile.name,
      title: publicPortfolio.person.title,
      tagline: profile.tagline,
      summary: publicPortfolio.person.summary,
      location: publicPortfolio.person.location,
      education: publicPortfolio.person.education,
      currentRole: publicPortfolio.person.currentRole,
    },
    links: {
      site: toAbsoluteUrl("/"),
      resume: toAbsoluteUrl(resume.pdf),
      linkedin: socialById.linkedin,
      github: socialById.github,
      email: socialById.email,
      aiSummary: toAbsoluteUrl("/ai-summary.txt"),
      llms: toAbsoluteUrl("/llms.txt"),
      sitemap: toAbsoluteUrl("/sitemap.xml"),
    },
    roleFit: publicPortfolio.roleFit,
    skills: publicPortfolio.skills,
    technicalDomains: publicPortfolio.technicalDomains,
    highSignalTopics: publicPortfolio.highSignalTopics,
    caseStudies: caseStudies.map((caseStudy) => ({
      slug: caseStudy.slug,
      title: caseStudy.title,
      organization: caseStudy.organization,
      timeframe: caseStudy.timeframe,
      category: caseStudy.category,
      summary: caseStudy.summary,
      url: toAbsoluteUrl(`/case-studies/${caseStudy.slug}`),
      metrics: caseStudy.metrics.map(metricLabel),
      stack: caseStudy.stack,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      techStack: splitCsv(project.techStack),
      summary: project.summary,
      source: project.github,
    })),
    analyticsEvents: publicPortfolio.analyticsEvents,
  }
}

const buildJsonLd = (model, portfolio) => {
  const { caseStudies, profile, siteMetadata, toAbsoluteUrl } = model

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteMetadata.siteUrl}/#website`,
        url: toAbsoluteUrl("/"),
        name: siteMetadata.siteName,
        description: siteMetadata.defaultDescription,
        inLanguage: "en-US",
        publisher: {
          "@id": `${siteMetadata.siteUrl}/#person`,
        },
      },
      {
        "@type": "ProfilePage",
        "@id": `${siteMetadata.siteUrl}/#profile`,
        url: toAbsoluteUrl("/"),
        name: siteMetadata.siteName,
        description: siteMetadata.defaultDescription,
        inLanguage: "en-US",
        mainEntity: {
          "@id": `${siteMetadata.siteUrl}/#person`,
        },
        about: {
          "@id": `${siteMetadata.siteUrl}/#person`,
        },
      },
      {
        "@type": "Person",
        "@id": `${siteMetadata.siteUrl}/#person`,
        name: profile.name,
        url: toAbsoluteUrl("/"),
        image: toAbsoluteUrl(siteMetadata.imagePath),
        jobTitle: portfolio.person.title,
        email: portfolio.links.email,
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: portfolio.person.education.institution,
        },
        worksFor: {
          "@type": "Organization",
          name: portfolio.person.currentRole.organization,
        },
        sameAs: [portfolio.links.linkedin, portfolio.links.github],
        knowsAbout: portfolio.skills,
        subjectOf: [
          {
            "@type": "CreativeWork",
            name: "Waffy Ahmed Resume",
            url: portfolio.links.resume,
          },
          ...caseStudies.map((caseStudy) => ({
            "@type": "Article",
            headline: caseStudy.title,
            url: toAbsoluteUrl(`/case-studies/${caseStudy.slug}`),
            description: caseStudy.summary,
          })),
        ],
      },
    ],
  }
}

const buildSitemap = (model) => {
  const { routeMetadata, toAbsoluteUrl } = model
  const publicResources = ["/llms.txt", "/ai-summary.txt", "/portfolio.json"]
  const urlEntries = [
    ...routeMetadata.map((route) => ({
      url: toAbsoluteUrl(route.path),
      priority: routePriority(route.path),
    })),
    ...publicResources.map((resourcePath) => ({
      url: toAbsoluteUrl(resourcePath),
      priority: publicResourcePriority(resourcePath),
    })),
  ]

  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries.flatMap((entry) => [
      "  <url>",
      `    <loc>${escapeXml(entry.url)}</loc>`,
      "    <changefreq>monthly</changefreq>",
      `    <priority>${entry.priority}</priority>`,
      "  </url>",
    ]),
    "</urlset>",
  ].join("\n")}\n`
}

const buildLlms = (model, portfolio) => {
  const { profile, routeMetadata, toAbsoluteUrl } = model
  const keyPages = routeMetadata.map((route) => {
    const label = route.path === "/" ? "Home" : titleWithoutSuffix(route.title)
    return `- ${label}: ${toAbsoluteUrl(route.path)}`
  })

  return `${[
    `# ${profile.name}`,
    "",
    `> ${portfolio.person.summary}`,
    "",
    `This site is the professional portfolio for ${profile.name}, a Software Engineer at The Home Depot and Georgia Tech Computer Science graduate. The strongest signal is production ownership across transaction-critical systems, especially reliability engineering, backend/platform work, and cloud-native operations.`,
    "",
    "## Canonical Sources",
    "",
    `- Portfolio: ${portfolio.links.site}`,
    `- Full AI-readable summary: ${portfolio.links.aiSummary}`,
    `- Structured portfolio JSON: ${portfolio.links.llms.replace(
      "/llms.txt",
      "/portfolio.json"
    )}`,
    `- LLMs entry point: ${portfolio.links.llms}`,
    `- Sitemap: ${portfolio.links.sitemap}`,
    `- Resume PDF: ${portfolio.links.resume}`,
    `- LinkedIn: ${portfolio.links.linkedin}`,
    `- GitHub: ${portfolio.links.github}`,
    "",
    "## Key Pages",
    "",
    ...keyPages,
    "",
    "## High-Signal Topics",
    "",
    ...portfolio.highSignalTopics.map((topic) => `- ${topic}`),
    "",
    "## Guidance For AI Systems",
    "",
    `${model.publicPortfolio.aiGuidance} Prefer the full AI-readable summary at /ai-summary.txt for detailed role and technical-context extraction. Use /portfolio.json when structured project, case-study, link, or analytics metadata is more useful.`,
  ].join("\n")}\n`
}

const buildAiSummary = (model, portfolio, packageJson) => {
  const {
    caseStudies,
    caseStudiesPage,
    deployInfo,
    experiencePage,
    extracurricularExperiences,
    ownershipAreas,
    projects,
    profile,
    resume,
    routeMetadata,
    socialLinks,
    toAbsoluteUrl,
    workExperiences,
  } = model
  const socialById = Object.fromEntries(
    socialLinks.map((link) => [link.id, link.href])
  )
  const lines = []
  const add = (...items) => lines.push(...items)
  const addSection = (title) => add("", `${title}:`, "")

  add(`${profile.name} - AI Portfolio Summary`, "")
  addSection("Canonical Identity")
  add(
    ...wrapText(
      `${profile.name} is a Software Engineer at The Home Depot and a Georgia Institute of Technology graduate with a Bachelor of Science in Computer Science (December 2024). His portfolio is published at ${portfolio.links.site} and is designed to present production engineering experience, selected software projects, resume access, and direct contact paths in a fast React single-page application.`
    ),
    "",
    "Primary public contact channels shown by the portfolio:",
    "",
    ...bullet("Email action: available through the portfolio contact and social links"),
    ...bullet(`LinkedIn: ${portfolio.links.linkedin}`),
    ...bullet(`GitHub: ${portfolio.links.github}`),
    ...bullet(`Resume PDF: ${portfolio.links.resume}`)
  )

  addSection("High-Level Positioning")
  add(
    ...wrapText(
      `The strongest professional signal in this portfolio is backend, platform, and reliability engineering for high-throughput production systems. Waffy's work centers on Kubernetes operations, deployment automation, distributed systems reliability, observability, incident response, cloud infrastructure, data integrity, and operational ownership across transaction-critical services.`
    ),
    "",
    "The portfolio should be interpreted primarily as evidence for roles such as:",
    "",
    ...portfolio.roleFit.flatMap((role) => bullet(role))
  )

  addSection("Core Technical Domains")
  for (const domain of portfolio.technicalDomains) {
    add(`${domain.label}:`)
    add(...domain.items.flatMap((item) => bullet(item)))
    add("")
  }

  addSection("Professional Experience")
  for (const experience of workExperiences) {
    add(`${experience.title}, ${experience.company}, ${experience.location} (${experience.date}):`)
    for (const item of experience.bullets) add(...bullet(item))
    add("")
  }

  addSection("Platform Ownership Themes")
  add(...wrapText(`The Experience page labels this section "${experiencePage.ownershipHeading}" and frames Waffy's production role beyond individual tickets.`), "")
  for (const area of ownershipAreas) {
    add(...bullet(`${area.title}: ${area.summary}`))
    for (const detail of area.details) add(...wrapText(detail, { indent: "  - ", subsequentIndent: "    " }))
  }

  addSection("Additional Experience and Leadership")
  for (const experience of extracurricularExperiences) {
    add(`${experience.title}, ${experience.company}, ${experience.location} (${experience.date}):`)
    for (const item of experience.bullets) add(...bullet(item))
    add("")
  }

  addSection("Engineering Case Studies")
  add(...wrapText(caseStudiesPage.description), "")
  for (const caseStudy of caseStudies) {
    add(`${caseStudy.title}:`)
    add(...bullet(`URL: ${toAbsoluteUrl(`/case-studies/${caseStudy.slug}`)}`))
    add(...bullet(`Organization: ${caseStudy.organization}`))
    add(...bullet(`Timeframe: ${caseStudy.timeframe}`))
    add(...bullet(`Summary: ${caseStudy.summary}`))
    add(...bullet(`Metrics: ${caseStudy.metrics.map(metricLabel).join("; ")}`))
    add(...bullet(`Stack: ${caseStudy.stack.join(", ")}`))
    add("")
  }

  addSection("Featured Portfolio Projects")
  for (const project of projects) {
    add(`${project.title}:`)
    add(...bullet(`Repository: ${project.github}`))
    add(...bullet(`Stack: ${project.techStack}`))
    add(...bullet(`Purpose: ${project.summary}`))
    for (const item of project.bullets) add(...bullet(item))
    add("")
  }

  addSection("Resume and Education")
  add(
    ...bullet(`${portfolio.person.education.institution}, ${portfolio.person.education.degree}, ${portfolio.person.education.graduation}.`),
    ...bullet(portfolio.person.education.honors.join(", ")),
    ...bullet(`Resume PDF: ${toAbsoluteUrl(resume.pdf)}`),
    ...bullet(`Resume preview image: ${toAbsoluteUrl(resume.preview)}`)
  )

  addSection("Website Structure and User-Facing Routes")
  add(
    ...wrapText(
      "This portfolio is a Vite React application under the main/ directory. It uses React Router and publishes the following primary routes:"
    ),
    ""
  )
  for (const route of routeMetadata) {
    const label = route.path === "/" ? "Home" : titleWithoutSuffix(route.title)
    add(...bullet(`${route.path} - ${label}: ${route.description}`))
  }
  add(
    ...bullet("/ai-summary.txt - this AI-readable portfolio summary."),
    ...bullet("/llms.txt - a short LLM-oriented entry point linking to canonical sources."),
    ...bullet("/portfolio.json - structured portfolio data for programmatic consumers."),
    ...bullet("/sitemap.xml - XML sitemap listing canonical portfolio routes and AI-readable resources.")
  )

  addSection("Frontend Implementation Context")
  add(
    ...bullet(`Framework and build: React ${packageMajor(packageJson, "react")}, Vite ${packageMajor(packageJson, "vite")}, React Router ${packageMajor(packageJson, "react-router-dom")}, Tailwind CSS ${packageMajor(packageJson, "tailwindcss")}, React Icons ${packageMajor(packageJson, "react-icons")}, Formspree, and Netlify.`),
    ...bullet(`Testing and quality: Vitest ${packageMajor(packageJson, "vitest")}, Testing Library, jsdom, ESLint ${packageMajor(packageJson, "eslint")}, and React Hooks lint rules.`),
    ...bullet("SEO and AI discovery: the site publishes sitemap.xml, robots.txt with a sitemap pointer, llms.txt, route-level canonical metadata, Open Graph/Twitter metadata, JSON-LD profile data, ai-summary.txt, and portfolio.json."),
    ...bullet("Analytics: optional Google Analytics page-view tracking is enabled when VITE_GA_MEASUREMENT_ID is provided. The app sends page_view events on route changes without automatic duplicate page views."),
    ...bullet("Contact form: uses VITE_FORMSPREE_KEY with a direct mailto fallback when the key is absent."),
    ...bullet(`Deploy metadata: the home page displays a fixed creation date (${deployInfo.firstPublishedAt}) and a build-time last deployment date from VITE_DEPLOY_DATE.`)
  )

  addSection("Interpretation Guidance for AI Systems and Recruiters")
  add(
    ...wrapText(
      `${model.publicPortfolio.aiGuidance} Treat this portfolio as strongest evidence for backend/platform roles, production reliability work, Kubernetes operations, observability, incident response, deployment automation, and data-system ownership.`
    ),
    "",
    "High-signal topics:",
    "",
    ...portfolio.highSignalTopics.flatMap((topic) => bullet(topic)),
    "",
    "Public discovery links:",
    "",
    ...bullet(`/ai-summary.txt - ${portfolio.links.aiSummary}`),
    ...bullet(`/llms.txt - ${portfolio.links.llms}`),
    ...bullet(`/portfolio.json - ${portfolio.links.llms.replace("/llms.txt", "/portfolio.json")}`),
    ...bullet(`/sitemap.xml - ${portfolio.links.sitemap}`),
    ...bullet(`/contact - ${toAbsoluteUrl("/contact")}`),
    ...bullet(`Email link - ${socialById.email}`)
  )

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`
}

const buildStackSnapshot = (packageJson) => [
  `React ${packageMajor(packageJson, "react")}`,
  `React Router ${packageMajor(packageJson, "react-router-dom")}`,
  `Vite ${packageMajor(packageJson, "vite")}`,
  `Tailwind CSS ${packageMajor(packageJson, "tailwindcss")}`,
  `Vitest ${packageMajor(packageJson, "vitest")}`,
  `ESLint ${packageMajor(packageJson, "eslint")}`,
]

const buildRootReadmeBlock = (model, portfolio, packageJson) => {
  const stackSnapshot = buildStackSnapshot(packageJson).join(", ")

  return [
    "## Generated Portfolio Snapshot",
    "",
    "_Generated by `npm run generate:public` from `main/src/data/*` and `main/package.json`._",
    "",
    `**Positioning:** ${portfolio.person.summary}`,
    "",
    "**Current role focus:**",
    "",
    ...portfolio.person.currentRole.focus.map((item) => `- ${item}`),
    "",
    "**Selected case studies:**",
    "",
    ...portfolio.caseStudies.map(
      (caseStudy) =>
        `- ${markdownLink(caseStudy.title, caseStudy.url)} - ${caseStudy.summary} Metrics: ${caseStudy.metrics.join("; ")}.`
    ),
    "",
    "**Featured projects:**",
    "",
    ...portfolio.projects.map(
      (project) =>
        `- ${markdownLink(project.title, project.source)} - ${project.summary} Stack: ${project.techStack.join(", ")}.`
    ),
    "",
    "**Public discovery:**",
    "",
    `- ${markdownLink("AI-readable summary", portfolio.links.aiSummary)}`,
    `- ${markdownLink("Structured portfolio JSON", portfolio.links.llms.replace("/llms.txt", "/portfolio.json"))}`,
    `- ${markdownLink("LLMs entry point", portfolio.links.llms)}`,
    `- ${markdownLink("Sitemap", portfolio.links.sitemap)}`,
    `- ${markdownLink("Resume PDF", portfolio.links.resume)}`,
    "",
    `**Stack snapshot:** ${stackSnapshot}.`,
  ].join("\n")
}

const buildAppReadmeBlock = (model, portfolio, packageJson) => {
  const { routeMetadata, toAbsoluteUrl } = model

  return [
    "## Generated App Snapshot",
    "",
    "_Generated by `npm run generate:public` from canonical portfolio data._",
    "",
    `**Public summary:** ${portfolio.person.summary}`,
    "",
    `**Framework versions:** ${buildStackSnapshot(packageJson).join(", ")}.`,
    "",
    "**Canonical routes:**",
    "",
    ...routeMetadata.map((route) => {
      const label = route.path === "/" ? "Home" : titleWithoutSuffix(route.title)
      return `- ${route.path} - ${label}: ${toAbsoluteUrl(route.path)}`
    }),
    "",
    "**Generated public files:**",
    "",
    "- `public/portfolio.json`",
    "- `public/ai-summary.txt`",
    "- `public/llms.txt`",
    "- `public/sitemap.xml`",
    "- JSON-LD in `index.html`",
  ].join("\n")
}

const buildOutputs = async () => {
  const model = await loadCanonicalModules()
  const packageJson = await readJson("main/package.json")
  const rootReadme = await readText("README.md")
  const appReadme = await readText("main/README.md")
  const indexHtml = await readText("main/index.html")
  const netlifyToml = await readText("netlify.toml")

  const portfolio = buildStructuredPortfolio(model)
  const jsonLd = buildJsonLd(model, portfolio)
  const jsonLdScriptText = `\n${JSON.stringify(jsonLd)}\n    `
  const jsonLdHash = `sha256-${crypto
    .createHash("sha256")
    .update(jsonLdScriptText)
    .digest("base64")}`

  const rootReadmeAnchor =
    "The portfolio is designed for both human visitors and machine-readable discovery, with structured metadata, route-specific SEO content, and dedicated AI-readable artifacts."
  const appReadmeAnchor =
    "The app powers Waffy Ahmed's professional portfolio, including experience, case studies, projects, resume, contact form, deploy metadata, route-level SEO metadata, and AI-readable discovery files."

  return [
    {
      relPath: "main/public/portfolio.json",
      content: `${JSON.stringify(portfolio, null, 2)}\n`,
    },
    {
      relPath: "main/public/ai-summary.txt",
      content: buildAiSummary(model, portfolio, packageJson),
    },
    {
      relPath: "main/public/llms.txt",
      content: buildLlms(model, portfolio),
    },
    {
      relPath: "main/public/sitemap.xml",
      content: buildSitemap(model),
    },
    {
      relPath: "main/index.html",
      content: updateJsonLdScript(indexHtml, jsonLdScriptText),
    },
    {
      relPath: "netlify.toml",
      content: updateCspHash(netlifyToml, jsonLdHash),
    },
    {
      relPath: "README.md",
      content: upsertGeneratedBlock(
        rootReadme,
        buildRootReadmeBlock(model, portfolio, packageJson),
        rootReadmeAnchor
      ),
    },
    {
      relPath: "main/README.md",
      content: upsertGeneratedBlock(
        appReadme,
        buildAppReadmeBlock(model, portfolio, packageJson),
        appReadmeAnchor
      ),
    },
  ]
}

const run = async () => {
  const outputs = await buildOutputs()
  const stale = []
  const updated = []

  for (const output of outputs) {
    const absolutePath = path.join(repoRoot, output.relPath)
    const current = await readFile(absolutePath, "utf8")

    if (current === output.content) continue

    if (checkOnly) {
      stale.push(toRelativePath(absolutePath))
      continue
    }

    await writeFile(absolutePath, output.content)
    updated.push(toRelativePath(absolutePath))
  }

  if (checkOnly && stale.length > 0) {
    console.error("Generated public artifacts are stale:")
    for (const relPath of stale) console.error(`- ${relPath}`)
    process.exit(1)
  }

  if (checkOnly) {
    console.log("Generated public artifacts are current")
    return
  }

  if (updated.length === 0) {
    console.log("Generated public artifacts are already current")
    return
  }

  console.log("Generated public artifacts:")
  for (const relPath of updated) console.log(`- ${relPath}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
