import type { ReactElement } from "react";
import { LogoMark, LoginFormFields, LoginFooterLinks } from "./shared.js";

/**
 * Variant 3 — "Top Bar + Card". A slim top navigation bar (logo + help
 * link) above a centered card on a subtle neutral page background,
 * distinguishing the card surface from the page.
 */
export default function LoginVariant3(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-surface-elevated px-6 py-4">
        <LogoMark />
        <a href="#" className="text-sm text-text-muted hover:text-text">
          Precisa de ajuda?
        </a>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface-elevated p-8 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text">
              Acessar plataforma
            </h1>
            <p className="text-sm text-text-muted">
              Use seu e-mail corporativo para entrar.
            </p>
          </div>
          <LoginFormFields />
          <LoginFooterLinks />
        </div>
      </main>
    </div>
  );
}
