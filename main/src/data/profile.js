import gtLogo from "../images/gtLogo.png"
import profilePicture450Webp from "../images/profilePic-450.webp"
import profilePicture675Webp from "../images/profilePic-675.webp"
import profilePicture from "../images/profilePic.jpg"
import { resumePreviewSrcSet, resumePreviewSizes } from "./resume-preview.mjs"
import {
  currentEmployment,
  portfolioUrls,
  profileIdentity,
  professionalIdentity,
} from "./siteIdentity.js"

export { portfolioUrls }

export const profile = {
  name: profileIdentity.name,
  tagline: professionalIdentity.headline,
  intro:
    `I'm a ${currentEmployment.currentTitle} at ${currentEmployment.organization}, productionizing reconciliation workflows as secure Kubernetes CronJobs and adapting data-access paths from Cloud SQL to Cloud Spanner with Workload Identity and cross-project IAM. I also lead security and CI/CD remediation through framework upgrades and pipeline fixes across production services. Across my Home Depot tenure, I've owned operational health across 60+ repositories supporting transaction-critical services. Previously, I interned at The Home Depot twice and led a team of six building a data reconciliation platform for the CDC. I'm a Georgia Tech graduate focused on ${professionalIdentity.focus}, with a production reliability specialty and a drive to build systems that don\u2019t page you at 2 AM.`,
  profilePicture,
  profilePictureSources: {
    webp: `${profilePicture450Webp} 450w, ${profilePicture675Webp} 675w`,
  },
  educationLogo: gtLogo,
}

export const resume = {
  introduction: `${currentEmployment.currentTitle} at ${currentEmployment.organization}, specializing in ${professionalIdentity.focus}. A focused snapshot of production reliability, deployment automation, and full-stack project work.`,
  pdf: "/waffyAhmedResume.pdf",
  preview: "/resume-preview.png",
  optimizedPreview: "/resume-preview.webp",
  previewSrcSet: resumePreviewSrcSet,
  previewSizes: resumePreviewSizes,
}

export const contact = {
  heading: "Let's connect",
  intro:
    "Have an opportunity, feedback, or a good engineering conversation in mind? Send a note and I will get back to you.",
}

export const socialLinks = [
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/wa24/",
    external: true,
  },
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/waffy1901",
    external: true,
  },
  {
    id: "email",
    label: "Email",
    href: "mailto:waffyahmed@gmail.com",
    external: false,
  },
]

export const deployInfo = {
  firstPublishedAt: "2024-09-12T14:17:00-04:00",
}
