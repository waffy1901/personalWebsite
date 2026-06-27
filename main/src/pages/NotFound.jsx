import React from "react";
import { Link } from "react-router-dom";
import { PageContainer, PageShell, StatusBadge } from "../components/MissionControl.jsx";

function NotFound() {
  return (
    <PageShell>
      <PageContainer className="flex min-h-[60dvh] items-center justify-center">
        <section className="mc-panel max-w-2xl p-8 text-center">
          <StatusBadge tone="orange">404</StatusBadge>
          <h1 className="mt-5 text-4xl font-black text-[#0B1220]">Page not found</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            That route is outside the portfolio map, but the main site is ready.
          </p>
          <Link to="/" className="mc-button-light mt-6">
            Go home
          </Link>
        </section>
      </PageContainer>
    </PageShell>
  );
}

export default NotFound;
