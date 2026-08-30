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

export default function PlatformSettings(): ReactElement {
  const auth = useAuth();
  if (auth.status !== "authenticated") return <></>;
  const user = auth.session.user;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Informações da conta proprietária e controles de segurança ativos."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conta da plataforma</CardTitle>
            <CardDescription>
              Identidade utilizada para administrar o SaaS.
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
            <CardTitle>Segurança</CardTitle>
            <CardDescription>
              Proteções aplicadas pelo servidor a esta sessão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 text-success-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  MFA {user.mfaEnabled ? "ativado" : "pendente"}
                </p>
                <p className="text-sm text-text-muted">
                  Autenticação TOTP e códigos de recuperação.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound
                className="mt-0.5 h-5 w-5 text-primary-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Sessão protegida</p>
                <p className="text-sm text-text-muted">
                  Token curto, refresh rotativo e proteção CSRF.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 text-success-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Autorização no backend</p>
                <p className="text-sm text-text-muted">
                  {String(user.permissions.length)} permissões efetivas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
