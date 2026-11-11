import { caseStudySeoItems } from "./caseStudySeo.js"
import { currentEmployment, portfolioUrls, professionalIdentity, profileIdentity } from "./siteIdentity.js"
import { currentRoleSummary } from "./currentRoleHighlights.js"

const defaultDescription = currentRoleSummary

export const siteMetadata = {
  siteUrl: portfolioUrls.site,
  siteName: `${profileIdentity.name} | ${professionalIdentity.headline}`,
  defaultTitle: `${profileIdentity.name} | ${professionalIdentity.headline}`,
  defaultDescription,
  imagePath: "/og-image-v3.jpg",
  imageType: "image/jpeg",
  imageAlt: `${profileIdentity.name}'s ${professionalIdentity.focus} portfolio card with a graduation portrait`,
  author: profileIdentity.name,
  keywords: [
    "Waffy Ahmed",
    "software engineer",
    "backend engineer",
    "platform engineer",
    "reliability engineering",
    "Kubernetes",
    "observability",
    "CI/CD",
    "distributed systems",
    "The Home Depot",
    "Georgia Tech",
  ],
}

export const toCanonicalRoutePath = (routePath = "/") => {
  const slashlessPath = routePath.replace(/\/+$/, "")
  return slashlessPath ? `${slashlessPath}/` : "/"
}

export const routeMetadata = [
  {
    path: "/",
    title: siteMetadata.defaultTitle,
    description: defaultDescription,
  },
  {
    path: "/case-studies",
    title: "Case Studies | Waffy Ahmed",
    description:
      "Engineering case studies on Kubernetes autoscaling, production reconciliation, release security, AI-assisted payment triage, CI authentication, deployment recovery, and public health data.",
  },
  ...caseStudySeoItems.map((caseStudy) => ({
    path: `/case-studies/${caseStudy.slug}`,
    title: `${caseStudy.title} | Waffy Ahmed`,
    description: caseStudy.summary,
  })),
  {
    path: "/experience",
    title: "Experience | Waffy Ahmed",
    description:
      `${currentEmployment.currentTitle} at ${currentEmployment.organization}: ${professionalIdentity.focus}, production reliability, secure CI/CD, infrastructure, and cross-team technical guidance.`,
  },
  {
    path: "/projects",
    title: "Projects | Waffy Ahmed",
    description:
      "Software projects spanning public health reconciliation, mobile workflows, and an AI-assisted Jira-to-GKE hackathon delivery prototype.",
  },
  {
    path: "/resume",
    title: "Resume | Waffy Ahmed",
    description:
      `Resume preview, accessible HTML, and PDF download for ${profileIdentity.name}, ${currentEmployment.currentTitle} specializing in ${professionalIdentity.focus} and production reliability.`,
  },
  {
    path: "/contact",
    title: "Contact | Waffy Ahmed",
    description:
      "Contact Waffy Ahmed by form, email, LinkedIn, or GitHub for engineering opportunities and professional conversations.",
  },
].map((route) => ({
  ...route,
  canonicalPath: toCanonicalRoutePath(route.path),
}))

export const defaultRouteMetadata = {
  title: "Page Not Found | Waffy Ahmed",
  description:
    "The requested portfolio page could not be found. Return to Waffy Ahmed's software engineering portfolio.",
  canonicalPath: "/",
  robots: "noindex, nofollow",
}

const normalizeRoutePathname = (pathname = "/") =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname

export const getRouteMetadata = (pathname) =>
  routeMetadata.find(
    (route) => route.path === normalizeRoutePathname(pathname)
  ) ?? defaultRouteMetadata

export const toAbsoluteUrl = (path = "/") => {
  const baseUrl = siteMetadata.siteUrl.replace(/\/$/, "")
  return path === "/" ? `${baseUrl}/` : `${baseUrl}${path}`
}

export const toCanonicalRouteUrl = (routePath = "/") =>
  toAbsoluteUrl(toCanonicalRoutePath(routePath))

export const sitemapRoutes = routeMetadata.map((route) => route.canonicalPath)
