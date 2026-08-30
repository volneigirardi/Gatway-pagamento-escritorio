import { Button, Input, Label } from "@saas/ui-web";
import type { ReactElement } from "react";

/**
 * Shared logo mark for the login screen previews. Placeholder wordmark
 * only — no final brand asset exists yet.
 */
export function LogoMark({
  className = "",
}: {
  className?: string;
}): ReactElement {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
        S
      </div>
      <span className="text-lg font-semibold text-text">SaaS Enterprise</span>
    </div>
  );
}

export function LoginFormFields(): ReactElement {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="voce@empresa.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <a href="#" className="text-sm text-primary-600 hover:underline">
            Esqueceu a senha?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full">
        Entrar
      </Button>
    </form>
  );
}

export function LoginFooterLinks(): ReactElement {
  return (
    <p className="text-center text-sm text-text-muted">
      Não tem uma conta?{" "}
      <a href="#" className="font-medium text-primary-600 hover:underline">
        Fale com o time comercial
      </a>
    </p>
  );
}
