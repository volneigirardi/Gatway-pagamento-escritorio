import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type ReactElement, type SubmitEventHandler } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
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
import { formString } from "../lib/form.js";
import { useAuth } from "../lib/use-auth.js";

export default function PlatformInvoices(): ReactElement {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const invoicesQuery = useInfiniteQuery({
    queryKey: ["platform", "invoices", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.invoices({
        status,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ["platform", "subscriptions", "invoice-form"],
    queryFn: () => platformApi.subscriptions(),
  });
  const createMutation = useMutation({
    mutationFn: (form: FormData) => {
      const subscriptionId = formString(form, "subscriptionId");
      const subscription = subscriptionsQuery.data?.items.find(
        (item) => item.id === subscriptionId,
      );
      if (!subscription) throw new Error("Subscription not found");
      return platformApi.createInvoice({
        tenantId: subscription.tenantId,
        subscriptionId,
        dueDate: formString(form, "dueDate"),
        discountCents: Math.round(Number(form.get("discount") ?? 0) * 100),
        taxCents: Math.round(Number(form.get("tax") ?? 0) * 100),
        items: [
          {
            description: formString(form, "description"),
            quantity: Number(form.get("quantity") ?? 1),
            unitAmountCents: Math.round(Number(form.get("amount")) * 100),
          },
        ],
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform", "invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["platform", "dashboard"] }),
      ]);
    },
  });
  const invoices =
    invoicesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const subscriptions =
    subscriptionsQuery.data?.items.filter(
      (item) => item.status !== "canceled",
    ) ?? [];
  const canWrite =
    auth.status === "authenticated" &&
    auth.session.user.permissions.includes("platform:billing:write");

  const createInvoice: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    createMutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faturas"
        description="Emita cobranças internas e acompanhe sua liquidação."
        actions={
          canWrite ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nova fatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createInvoice} className="space-y-5">
                  <DialogHeader>
                    <DialogTitle>Emitir fatura</DialogTitle>
                    <DialogDescription>
                      Os valores são registrados em reais e persistidos em
                      centavos.
                    </DialogDescription>
                  </DialogHeader>
                  {createMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Fatura não emitida</AlertTitle>
                      <AlertDescription>
                        Verifique saldo, assinatura e valores informados.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="invoice-subscription">Assinatura</Label>
                    <Select name="subscriptionId" required>
                      <SelectTrigger id="invoice-subscription">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {subscriptions.map((subscription) => (
                          <SelectItem
                            key={subscription.id}
                            value={subscription.id}
                          >
                            {subscription.tenantId} —{" "}
                            {formatMoney(subscription.amountCents)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-description">Descrição</Label>
                    <Input
                      id="invoice-description"
                      name="description"
                      maxLength={240}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="invoice-quantity">Quantidade</Label>
                      <Input
                        id="invoice-quantity"
                        name="quantity"
                        type="number"
                        min={1}
                        max={100000}
                        defaultValue={1}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-amount">
                        Valor unitário (R$)
                      </Label>
                      <Input
                        id="invoice-amount"
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-discount">Desconto (R$)</Label>
                      <Input
                        id="invoice-discount"
                        name="discount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-tax">Impostos (R$)</Label>
                      <Input
                        id="invoice-tax"
                        name="tax"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-due">Vencimento</Label>
                    <Input
                      id="invoice-due"
                      name="dueDate"
                      type="date"
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending || subscriptions.length === 0
                      }
                    >
                      {createMutation.isPending
                        ? "Emitindo..."
                        : "Emitir fatura"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <Select
        value={status || "all"}
        onValueChange={(value) => {
          setStatus(value === "all" ? "" : value);
        }}
      >
        <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar faturas">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="open">Em aberto</SelectItem>
          <SelectItem value="paid">Pagas</SelectItem>
          <SelectItem value="overdue">Vencidas</SelectItem>
          <SelectItem value="void">Anuladas</SelectItem>
        </SelectContent>
      </Select>
      {invoicesQuery.isLoading ? <PageLoading /> : null}
      {invoicesQuery.isError ? (
        <QueryError retry={() => void invoicesQuery.refetch()} />
      ) : null}
      {!invoicesQuery.isLoading &&
      !invoicesQuery.isError &&
      invoices.length === 0 ? (
        <EmptyState
          title="Nenhuma fatura"
          description="Emita uma fatura a partir de uma assinatura ativa."
        />
      ) : null}
      {invoices.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fatura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-xs text-text-muted">
                      {invoice.tenantName ?? invoice.tenantId}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(invoice.status)}>
                      {statusLabel(invoice.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(invoice.totalCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {invoicesQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={invoicesQuery.isFetchingNextPage}
            onClick={() => void invoicesQuery.fetchNextPage()}
          >
            {invoicesQuery.isFetchingNextPage
              ? "Carregando..."
              : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
