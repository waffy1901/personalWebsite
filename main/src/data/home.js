import { hackathonPrototypeIdentity } from "./hackathonPrototypeIdentity.js";
import {
  autoscalingLatencyImpact,
  bookingSecurityImpact,
  orderReconciliationImpact,
  paymentTriageImpact,
} from "./impactMetrics.js";

export const homeContent = {
  impactMetrics: [
    bookingSecurityImpact,
    orderReconciliationImpact,
    paymentTriageImpact,
    autoscalingLatencyImpact,
  ],
  proofLink: "Explore recent backend and platform engineering work",
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
