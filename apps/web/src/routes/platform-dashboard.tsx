import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CircleDollarSign,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useState, type ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltipContent,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type ChartConfig,
} from "@saas/ui-web";
import { PageLoading, QueryError } from "../components/query-state.js";
import { platformApi } from "../lib/api.js";
import {
  formatDate,
  formatMoney,
  statusLabel,
  statusVariant,
} from "../lib/format.js";

const revenueConfig: ChartConfig = {
  receivedCents: { label: "Receita recebida", color: "var(--color-chart-1)" },
  subscriptionValueCents: {
    label: "Valor recorrente",
    color: "var(--color-chart-2)",
  },
};
const growthConfig: ChartConfig = {
  newTenants: { label: "Novas empresas", color: "var(--color-chart-3)" },
};
const planColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function planColor(index: number): string {
  return planColors[index % planColors.length] ?? "var(--color-chart-1)";
}

export default function PlatformDashboard(): ReactElement {
  const [period, setPeriod] = useState<"30d" | "90d" | "12m">("30d");
  const query = useQuery({
    queryKey: ["platform", "dashboard", period],
    queryFn: () => platformApi.dashboard(period),
  });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return <QueryError retry={() => void query.refetch()} />;
  const dashboard = query.data;
  const metrics = [
    {
      label: "MRR",
      value: formatMoney(dashboard.metrics.mrrCents),
      detail: `ARR ${formatMoney(dashboard.metrics.arrCents)}`,
      icon: CircleDollarSign,
    },
    {
      label: "Empresas ativas",
      value: String(dashboard.metrics.activeTenants),
      detail: `${String(dashboard.metrics.trialingTenants)} em teste`,
      icon: Building2,
    },
    {
      label: "Receita recebida",
      value: formatMoney(dashboard.metrics.receivedCents),
      detail: `${String(dashboard.metrics.paymentSuccessRate)}% de sucesso`,
      icon: TrendingUp,
    },
    {
      label: "Valor em aberto",
      value: formatMoney(dashboard.metrics.outstandingCents),
      detail: `Churn ${String(dashboard.metrics.churnRate)}%`,
      icon: WalletCards,
    },
    {
      label: "ARPA",
      value: formatMoney(dashboard.metrics.arpaCents),
      detail: "Receita média por empresa",
      icon: Users,
    },
    {
      label: "Novas empresas",
      value: String(dashboard.metrics.newTenants),
      detail: `${String(dashboard.metrics.suspendedTenants)} suspensas`,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Acompanhe receita recorrente, crescimento e itens que precisam de atenção."
        actions={
          <Select
            value={period}
            onValueChange={(value) => {
              setPeriod(value as typeof period);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Período do dashboard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicadores principais"
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-text-muted">
                  {metric.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {metric.value}
                </div>
                <p className="mt-1 text-xs text-text-muted">{metric.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Tendências">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Receita e recorrência</CardTitle>
            <CardDescription>
              Valores mensais registrados internamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.series.length > 0 ? (
              <ChartContainer
                config={revenueConfig}
                className="h-72"
                aria-label="Gráfico mensal de receita e recorrência"
              >
                <AreaChart
                  accessibilityLayer
                  data={dashboard.series}
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => formatMoney(value)}
                    width={88}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent valueFormatter={formatMoney} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="receivedCents"
                    stroke="var(--color-receivedCents)"
                    fill="var(--color-receivedCents)"
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="subscriptionValueCents"
                    stroke="var(--color-subscriptionValueCents)"
                    fill="var(--color-subscriptionValueCents)"
                    fillOpacity={0.08}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="py-24 text-center text-sm text-text-muted">
                Ainda não há dados para o período.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Empresas por plano</CardTitle>
            <CardDescription>Distribuição das empresas ativas.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.planDistribution.some((item) => item.tenants > 0) ? (
              <ChartContainer
                config={{
                  tenants: { label: "Empresas", color: "var(--color-chart-1)" },
                }}
                className="h-56"
                aria-label="Distribuição de empresas por plano"
              >
                <PieChart accessibilityLayer>
                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={dashboard.planDistribution
                      .filter((item) => item.tenants > 0)
                      .map((item, index) => ({
                        ...item,
                        fill: planColor(index),
                        stroke: "var(--color-background)",
                      }))}
                    dataKey="tenants"
                    nameKey="planName"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-20 text-center text-sm text-text-muted">
                Nenhuma empresa ativa.
              </p>
            )}
            <div className="mt-3 space-y-2">
              {dashboard.planDistribution.map((item, index) => (
                <div
                  key={item.planId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor: planColor(index),
                      }}
                      aria-hidden="true"
                    />
                    {item.planName}
                  </span>
                  <span className="font-medium tabular-nums">
                    {item.tenants}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento de contas</CardTitle>
            <CardDescription>Novas empresas por mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={growthConfig}
              className="h-60"
              aria-label="Novas empresas por mês"
            >
              <BarChart accessibilityLayer data={dashboard.series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="newTenants"
                  fill="var(--color-newTenants)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Itens que precisam de atenção</CardTitle>
            <CardDescription>
              Faturas vencidas e provisionamentos com falha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-medium">Faturas vencidas</h3>
              {dashboard.attention.overdueInvoices.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Nenhuma fatura vencida.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fatura</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.attention.overdueInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.number}
                        </TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(invoice.totalCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">
                Falhas de provisionamento
              </h3>
              {dashboard.attention.failedProvisioning.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Nenhuma falha de provisionamento.
                </p>
              ) : (
                <div className="space-y-2">
                  {dashboard.attention.failedProvisioning.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-text-muted">
                          Atualizado em {formatDate(tenant.updatedAt)}
                        </p>
                      </div>
                      <Badge variant={statusVariant("failed")}>
                        {statusLabel("failed")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
