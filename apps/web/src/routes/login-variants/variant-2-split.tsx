import type { ReactElement } from "react";
import { LogoMark, LoginFormFields, LoginFooterLinks } from "./shared.js";

/**
 * Variant 2 — "Split Screen". Form on the left (white), a solid primary
 * panel on the right with the product name and a short value proposition.
 * No gradients or illustrations, per the frozen minimalist principles.
 */
export default function LoginVariant2(): ReactElement {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-6">
          <LogoMark />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-text-muted">
              Entre com suas credenciais para continuar.
            </p>
          </div>
          <LoginFormFields />
          <LoginFooterLinks />
        </div>
      </div>
      <div className="hidden flex-col items-start justify-end bg-primary-900 p-12 text-white md:flex">
        <blockquote className="max-w-md space-y-4">
          <p className="text-lg font-medium">
            "A fundação multi-tenant que precisávamos, com isolamento e
            auditoria desde o primeiro dia."
          </p>
          <footer className="text-sm text-primary-200">
            Equipe de Operações — Cliente Enterprise
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
