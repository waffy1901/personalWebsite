import gtLogo from "../images/gtLogo.png"
import profilePicture from "../images/profilePic.jpg"

export const profile = {
  name: "Waffy Ahmed",
  tagline: "Software Engineer | Georgia Tech",
  intro:
    "I'm a Software Engineer at The Home Depot, owning operational health across 60+ repositories that support transaction-critical services. My work focuses on Kubernetes autoscaling, deployment automation, observability, and incident response for high-throughput systems processing millions of transactions daily. Previously, I interned at The Home Depot twice and led a team of six building a data reconciliation platform for the CDC. I'm a Georgia Tech graduate focused on reliability engineering and building systems that don\u2019t page you at 2 AM.",
  profilePicture,
  educationLogo: gtLogo,
}

export const resume = {
  pdf: "/waffyAhmedResume.pdf",
  preview: "/resume-preview.png",
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
  firstPublishedAt: "2024-09-13T19:43:00Z",
}

export const portfolioUrls = {
  site: "https://waffy.dev",
  aiSummary: "https://waffy.dev/ai-summary.txt",
}
