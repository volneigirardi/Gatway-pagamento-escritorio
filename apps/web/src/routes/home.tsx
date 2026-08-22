import { Button } from "@saas/ui-web";
import type { ReactElement } from "react";

export default function Home(): ReactElement {
  return (
    <section className="space-y-4" aria-labelledby="home-title">
      <h1 id="home-title" className="text-2xl font-bold">
        SaaS Enterprise
      </h1>
      <p className="text-text-muted">
        Foundation scaffold. No business logic yet.
      </p>
      <Button>Get started</Button>
    </section>
  );
}
