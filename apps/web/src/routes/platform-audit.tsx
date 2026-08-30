import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState, type ReactElement } from "react";
import {
  Badge,
  Button,
  Input,
  PageHeader,
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
import { formatDate } from "../lib/format.js";
import { useDebouncedValue } from "../lib/use-debounced-value.js";

export default function PlatformAudit(): ReactElement {
  const [action, setAction] = useState("");
  const debouncedAction = useDebouncedValue(action);
  const query = useInfiniteQuery({
    queryKey: ["platform", "audit", debouncedAction],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.auditLogs({
        action: debouncedAction,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Rastreie ações administrativas realizadas no controle da plataforma."
      />
      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          className="pl-10"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
          }}
          placeholder="Filtrar pela ação exata"
          aria-label="Filtrar auditoria por ação"
        />
      </div>
      {query.isLoading ? <PageLoading /> : null}
      {query.isError ? <QueryError retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState
          title="Nenhum evento de auditoria"
          description="Ajuste o filtro ou realize uma ação administrativa."
        />
      ) : null}
      {items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline">{item.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <p>{item.actorEmail ?? "Sistema"}</p>
                    {item.actorIdentityId ? (
                      <code className="text-xs text-text-muted">
                        {item.actorIdentityId.slice(0, 8)}
                      </code>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{item.resource}</p>
                    <p className="text-xs text-text-muted">
                      {item.resourceId ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {item.tenantId ? (
                      <code className="text-xs">
                        {item.tenantId.slice(0, 8)}
                      </code>
                    ) : (
                      "Plataforma"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
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
