import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, ReceiptText } from "lucide-react";
import type { ReactElement } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
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

export default function TenantSubscription(): ReactElement {
  const query = useQuery({
    queryKey: ["tenant", "overview"],
    queryFn: () => tenantApi.overview(),
  });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return <QueryError retry={() => void query.refetch()} />;
  const subscription = query.data.subscription;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinatura"
        description="Consulte o plano e o período de cobrança da sua empresa."
      />
      {!subscription ? (
        <Alert variant="warning">
          <AlertTitle>Assinatura indisponível</AlertTitle>
          <AlertDescription>
            Entre em contato com o administrador da plataforma.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className="max-w-3xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{subscription.planName}</CardTitle>
                  <CardDescription>
                    Plano contratado para este ambiente.
                  </CardDescription>
                </div>
                <Badge variant={statusVariant(subscription.status)}>
                  {statusLabel(subscription.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <CircleDollarSign
                  className="mt-0.5 h-5 w-5 text-primary-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-text-muted">Valor</p>
                  <p className="font-semibold">
                    {formatMoney(subscription.amountCents)}
                  </p>
                  <p className="text-xs text-text-muted">
                    por{" "}
                    {subscription.billingInterval === "monthly" ? "mês" : "ano"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays
                  className="mt-0.5 h-5 w-5 text-primary-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-text-muted">Período até</p>
                  <p className="font-semibold">
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ReceiptText
                  className="mt-0.5 h-5 w-5 text-primary-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-text-muted">Cobrança</p>
                  <p className="font-semibold">Interna</p>
                  <p className="text-xs text-text-muted">
                    Sem provedor externo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Alert>
            <AlertTitle>Sobre os pagamentos</AlertTitle>
            <AlertDescription>
              Os registros exibidos nesta versão são administrativos e ainda não
              possuem conciliação automática com banco ou provedor de pagamento.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
