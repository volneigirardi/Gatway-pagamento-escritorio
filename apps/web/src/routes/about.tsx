import type { ReactElement } from "react";

export default function About(): ReactElement {
  return (
    <section className="space-y-4" aria-labelledby="about-title">
      <h1 id="about-title" className="text-2xl font-bold">
        About
      </h1>
      <p className="text-text-muted">
        Enterprise multi-tenant SaaS foundation.
      </p>
    </section>
  );
}
