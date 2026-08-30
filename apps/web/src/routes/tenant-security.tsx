import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@saas/ui-web";
import { useAuth } from "../lib/use-auth.js";

export default function TenantSecurity(): ReactElement {
  const auth = useAuth();
  if (auth.status !== "authenticated") return <></>;
  const user = auth.session.user;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Segurança"
        description="Revise sua identidade, autenticação e acesso efetivo."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sua conta</CardTitle>
            <CardDescription>
              Identidade vinculada exclusivamente a esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-text-muted">E-mail</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-text-muted">Papéis</p>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Controles ativos</CardTitle>
            <CardDescription>
              Aplicados a todas as chamadas protegidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 text-success-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Autenticação multifator</p>
                <p className="text-sm text-text-muted">
                  {user.mfaEnabled
                    ? "Ativada com TOTP e códigos de recuperação."
                    : "Pendente de ativação."}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <KeyRound
                className="mt-0.5 h-5 w-5 text-primary-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Senha individual</p>
                <p className="text-sm text-text-muted">
                  A senha inicial deve ser alterada antes do acesso.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 text-success-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Isolamento da empresa</p>
                <p className="text-sm text-text-muted">
                  Dados e permissões são resolvidos pelo backend.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
