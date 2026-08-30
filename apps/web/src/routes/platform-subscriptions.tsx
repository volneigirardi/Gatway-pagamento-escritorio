import { useInfiniteQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import {
  Badge,
  Button,
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
} from "@saas/ui-web";
import {
  EmptyState,
  PageLoading,
  QueryError,
} from "../components/query-state.js";
import { platformApi } from "../lib/api.js";
import {
  formatDate,
  formatMoney,
  statusLabel,
  statusVariant,
} from "../lib/format.js";

export default function PlatformSubscriptions(): ReactElement {
  const [status, setStatus] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["platform", "subscriptions", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.subscriptions({
        status,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Acompanhe contratos, períodos vigentes e receita recorrente."
      />
      <Select
        value={status || "all"}
        onValueChange={(value) => {
          setStatus(value === "all" ? "" : value);
        }}
      >
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label="Filtrar assinaturas"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="trialing">Em teste</SelectItem>
          <SelectItem value="active">Ativas</SelectItem>
          <SelectItem value="past_due">Em atraso</SelectItem>
          <SelectItem value="suspended">Suspensas</SelectItem>
          <SelectItem value="canceled">Canceladas</SelectItem>
        </SelectContent>
      </Select>
      {query.isLoading ? <PageLoading /> : null}
      {query.isError ? <QueryError retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState
          title="Nenhuma assinatura"
          description="As assinaturas aparecerão após o cadastro das empresas."
        />
      ) : null}
      {items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Período atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <>
                      <p className="font-medium">
                        {item.tenantName ?? "Empresa"}
                      </p>
                      <code className="text-xs text-text-muted">
                        {item.tenantId}
                      </code>
                    </>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMoney(item.amountCents)} /{" "}
                    {item.billingInterval === "monthly" ? "mês" : "ano"}
                  </TableCell>
                  <TableCell>
                    {formatDate(item.currentPeriodStart)} –{" "}
                    {formatDate(item.currentPeriodEnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
