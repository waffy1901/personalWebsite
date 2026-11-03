import { hackathonPrototypeIdentity } from "./hackathonPrototypeIdentity.js";

export const homeContent = {
  proofLink: "Explore recent platform engineering work",
  proofPath: "/experience/",
  reliabilityHeading: "Production reliability from deployment to recovery.",
  exploreHeading: "Secure delivery, production data workflows, and practical builds.",
  secondaryEvidence: [
    {
      label: "Production incident response and recovery",
      to: "/experience/#production-recovery",
    },
    {
      label: `October hackathon: ${hackathonPrototypeIdentity.title}`,
      to: hackathonPrototypeIdentity.path,
    },
  ],
};
