import { caseStudies } from "./caseStudies"
import { portfolioUrls, profile } from "./profile"

const defaultDescription =
  "Software engineering portfolio for Waffy Ahmed, focused on reliability, Kubernetes, deployment automation, observability, and high-throughput systems."

export const siteMetadata = {
  siteUrl: portfolioUrls.site,
  siteName: "Waffy Ahmed | Software Engineer Portfolio",
  defaultTitle: "Waffy Ahmed | Software Engineer Portfolio",
  defaultDescription,
  imagePath: "/og-image.png",
  author: profile.name,
  keywords: [
    "Waffy Ahmed",
    "software engineer",
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
      "Engineering case studies covering Kubernetes autoscaling, legacy deployment recovery, and CDC data reconciliation work.",
  },
  ...caseStudies.map((caseStudy) => ({
    path: `/case-studies/${caseStudy.slug}`,
    title: `${caseStudy.title} | Waffy Ahmed`,
    description: caseStudy.summary,
  })),
  {
    path: "/experience",
    title: "Experience | Waffy Ahmed",
    description:
      "Professional experience across platform reliability, production operations, infrastructure, deployment automation, and full-stack engineering.",
  },
  {
    path: "/projects",
    title: "Projects | Waffy Ahmed",
    description:
      "Selected software projects spanning public health data reconciliation, mobile job search tooling, and campus discovery workflows.",
  },
  {
    path: "/resume",
    title: "Resume | Waffy Ahmed",
    description:
      "Resume preview and PDF download for Waffy Ahmed, software engineer focused on reliability and production systems.",
  },
  {
    path: "/contact",
    title: "Contact | Waffy Ahmed",
    description:
      "Contact Waffy Ahmed by form, email, LinkedIn, or GitHub for engineering opportunities and professional conversations.",
  },
]

export const defaultRouteMetadata = {
  title: "Page Not Found | Waffy Ahmed",
  description:
    "The requested portfolio page could not be found. Return to Waffy Ahmed's software engineering portfolio.",
  canonicalPath: "/",
  robots: "noindex, nofollow",
}

export const getRouteMetadata = (pathname) =>
  routeMetadata.find((route) => route.path === pathname) ?? defaultRouteMetadata

export const toAbsoluteUrl = (path = "/") => {
  const baseUrl = siteMetadata.siteUrl.replace(/\/$/, "")
  return path === "/" ? `${baseUrl}/` : `${baseUrl}${path}`
}

export const sitemapRoutes = routeMetadata.map((route) => route.path)
