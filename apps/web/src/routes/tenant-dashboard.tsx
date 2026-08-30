import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, Users, WalletCards } from "lucide-react";
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
import { PageLoading, QueryError } from "../components/query-state.js";
import { tenantApi } from "../lib/api.js";
import {
  formatDate,
  formatMoney,
  statusLabel,
  statusVariant,
} from "../lib/format.js";

export default function TenantDashboard(): ReactElement {
  const query = useQuery({
    queryKey: ["tenant", "overview"],
    queryFn: () => tenantApi.overview(),
  });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return <QueryError retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${data.currentUser.displayName}`}
        description="Acompanhe as informações essenciais da sua empresa."
      />
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Resumo da empresa"
      >
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-text-muted">Empresa</CardTitle>
            <Building2
              className="h-4 w-4 text-primary-600"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {data.settings.tradeName ?? data.settings.legalName ?? "Empresa"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              CNPJ {data.settings.taxId ?? "não informado"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-text-muted">
              Usuários ativos
            </CardTitle>
            <Users className="h-4 w-4 text-primary-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.activeUsers}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Contas com acesso ao ambiente
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-text-muted">Plano</CardTitle>
            <WalletCards
              className="h-4 w-4 text-primary-600"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            {data.subscription ? (
              <>
                <p className="text-xl font-semibold">
                  {data.subscription.planName}
                </p>
                <Badge
                  className="mt-2"
                  variant={statusVariant(data.subscription.status)}
                >
                  {statusLabel(data.subscription.status)}
                </Badge>
              </>
            ) : (
              <p className="text-sm text-text-muted">Sem assinatura</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-text-muted">
              Próximo período
            </CardTitle>
            <CalendarDays
              className="h-4 w-4 text-primary-600"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent>
            {data.subscription ? (
              <>
                <p className="text-xl font-semibold">
                  {formatDate(data.subscription.currentPeriodEnd)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {formatMoney(data.subscription.amountCents)} /{" "}
                  {data.subscription.billingInterval === "monthly"
                    ? "mês"
                    : "ano"}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">Não disponível</p>
            )}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Configuração atual</CardTitle>
          <CardDescription>
            Dados usados nas operações da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-text-muted">E-mail de contato</p>
            <p className="font-medium">
              {data.settings.contactEmail ?? "Não informado"}
            </p>
          </div>
          <div>
            <p className="text-text-muted">Fuso horário</p>
            <p className="font-medium">{data.settings.timezone}</p>
          </div>
          <div>
            <p className="text-text-muted">Idioma</p>
            <p className="font-medium">{data.settings.locale}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
