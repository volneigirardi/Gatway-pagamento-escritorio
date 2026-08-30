import type { ReactElement } from "react";
import { LogoMark, LoginFormFields, LoginFooterLinks } from "./shared.js";

/**
 * Variant 4 — "Borderless Minimal". No card, no border, no shadow — just
 * generous whitespace and the form directly on the page background, the
 * most minimal shadcn/ui-style interpretation of the frozen direction.
 */
export default function LoginVariant4(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-xs space-y-8">
        <LogoMark className="justify-center" />
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Entrar
          </h1>
          <p className="text-sm text-text-muted">
            Informe seus dados para continuar
          </p>
        </div>
        <LoginFormFields />
        <div className="border-t border-border pt-6">
          <LoginFooterLinks />
        </div>
      </div>
    </div>
  );
}
