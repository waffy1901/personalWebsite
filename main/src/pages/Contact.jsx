import React from "react";
import ContactForm from "../components/ContactForm";
import {
  PageContainer,
  PageShell,
  SectionHeader,
  StatusBadge,
} from "../components/MissionControl.jsx";
import SocialLinks from "../components/SocialLinks";
import { contact } from "../data/profile";

function Contact() {
  return (
    <PageShell className="mc-dark-field text-white">
      <PageContainer className="max-w-5xl">
        <SectionHeader
          eyebrow="Contact intake"
          title={contact.heading}
          description={contact.intro}
          align="center"
          tone="dark"
        />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ContactForm />

          <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <StatusBadge tone="green">Open channel</StatusBadge>
            <h2 className="mt-4 text-xl font-black text-white">
              Alternative routes
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              LinkedIn, GitHub, and email stay available for quick professional conversations.
            </p>
            <SocialLinks placement="contact" className="mt-5 grid gap-2" />
          </aside>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default Contact;
