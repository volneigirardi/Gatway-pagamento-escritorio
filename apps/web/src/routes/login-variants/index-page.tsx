import type { ReactElement } from "react";
import { Link } from "@tanstack/react-router";

const variants = [
  { path: "/login", label: "Login Blupo — Centralizado (aprovado)" },
  { path: "/login-preview/1", label: "Variante 1 — Cartão centralizado" },
  { path: "/login-preview/2", label: "Variante 2 — Tela dividida" },
  { path: "/login-preview/3", label: "Variante 3 — Barra superior + cartão" },
  { path: "/login-preview/4", label: "Variante 4 — Minimalista sem bordas" },
];

/**
 * Temporary index for design review only (ADR-013 follow-up: choosing a
 * login screen layout). Not a business route — remove once a direction is
 * approved and the real `/login` route is implemented.
 */
export default function LoginVariantsIndex(): ReactElement {
  return (
    <div className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-xl font-semibold text-text">
        Prévias de tela de login
      </h1>
      <p className="text-sm text-text-muted">
        Todas usam o tema "professional" (ADR-013). Escolha uma para evoluirmos
        o design system.
      </p>
      <ul className="space-y-2">
        {variants.map((v) => (
          <li key={v.path}>
            <Link
              to={v.path}
              className="block rounded-md border border-border bg-surface-elevated px-4 py-3 text-sm text-text hover:bg-surface"
            >
              {v.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
