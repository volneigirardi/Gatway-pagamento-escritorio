import type { ReactElement } from "react";
import { LogoMark, LoginFormFields, LoginFooterLinks } from "./shared.js";

/**
 * Variant 1 — "Centered Card" (classic SaaS pattern, e.g. Linear/Vercel).
 * Plain white page background, a single bordered card centered on screen.
 */
export default function LoginVariant1(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface-elevated p-8">
        <div className="space-y-2 text-center">
          <LogoMark className="justify-center" />
          <h1 className="text-xl font-semibold text-text">
            Entrar na sua conta
          </h1>
          <p className="text-sm text-text-muted">
            Acesse o painel para gerenciar sua empresa.
          </p>
        </div>
        <LoginFormFields />
        <LoginFooterLinks />
      </div>
    </div>
  );
}
