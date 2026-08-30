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

export default function PlatformPayments(): ReactElement {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const paymentsQuery = useInfiniteQuery({
    queryKey: ["platform", "payments", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.payments({
        status,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const invoicesQuery = useQuery({
    queryKey: ["platform", "invoices", "payment-form"],
    queryFn: () => platformApi.invoices(),
  });
  const recordMutation = useMutation({
    mutationFn: (form: FormData) => {
      const invoiceId = formString(form, "invoiceId");
      const invoice = invoicesQuery.data?.items.find(
        (item) => item.id === invoiceId,
      );
      if (!invoice) throw new Error("Invoice not found");
      const paymentStatus = formString(form, "status", "paid");
      return platformApi.recordPayment({
        tenantId: invoice.tenantId,
        invoiceId,
        method: formString(form, "method", "manual"),
        status: paymentStatus,
        amountCents: Math.round(Number(form.get("amount")) * 100),
        externalReference: formString(form, "externalReference") || undefined,
        failureCode:
          paymentStatus === "failed"
            ? formString(form, "failureCode") || undefined
            : undefined,
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setPaymentStatus("paid");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform", "payments"] }),
        queryClient.invalidateQueries({ queryKey: ["platform", "invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["platform", "dashboard"] }),
      ]);
    },
  });
  const payments =
    paymentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const invoices =
    invoicesQuery.data?.items.filter((item) =>
      ["open", "overdue"].includes(item.status),
    ) ?? [];
  const canWrite =
    auth.status === "authenticated" &&
    auth.session.user.permissions.includes("platform:billing:write");
  const recordPayment: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    recordMutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Registre liquidações internas e acompanhe falhas de cobrança."
        actions={
          canWrite ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Registrar
                  pagamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={recordPayment} className="space-y-5">
                  <DialogHeader>
                    <DialogTitle>Registrar pagamento</DialogTitle>
                    <DialogDescription>
                      Este registro é interno e não comprova liquidação bancária
                      externa.
                    </DialogDescription>
                  </DialogHeader>
                  {recordMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Pagamento não registrado</AlertTitle>
                      <AlertDescription>
                        O valor não pode exceder o saldo da fatura e a
                        referência deve ser única.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="payment-invoice">Fatura</Label>
                    <Select name="invoiceId" required>
                      <SelectTrigger id="payment-invoice">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.number} — {formatMoney(invoice.totalCents)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="payment-method">Método</Label>
                      <Select name="method" defaultValue="manual">
                        <SelectTrigger id="payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="bank_transfer">
                            Transferência
                          </SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                          <SelectItem value="card">Cartão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-status">Status</Label>
                      <Select
                        name="status"
                        value={paymentStatus}
                        onValueChange={setPaymentStatus}
                      >
                        <SelectTrigger id="payment-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="failed">Falhou</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-amount">Valor (R$)</Label>
                      <Input
                        id="payment-amount"
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-reference">
                        Referência externa
                      </Label>
                      <Input
                        id="payment-reference"
                        name="externalReference"
                        maxLength={255}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="payment-failure">
                        Código de falha, se aplicável
                      </Label>
                      <Input
                        id="payment-failure"
                        name="failureCode"
                        maxLength={100}
                        required={paymentStatus === "failed"}
                        disabled={paymentStatus !== "failed"}
                      />
                    </div>
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
                        recordMutation.isPending || invoices.length === 0
                      }
                    >
                      {recordMutation.isPending
                        ? "Registrando..."
                        : "Registrar"}
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
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label="Filtrar pagamentos"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="paid">Pagos</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="failed">Falhos</SelectItem>
          <SelectItem value="refunded">Reembolsados</SelectItem>
        </SelectContent>
      </Select>
      {paymentsQuery.isLoading ? <PageLoading /> : null}
      {paymentsQuery.isError ? (
        <QueryError retry={() => void paymentsQuery.refetch()} />
      ) : null}
      {!paymentsQuery.isLoading &&
      !paymentsQuery.isError &&
      payments.length === 0 ? (
        <EmptyState
          title="Nenhum pagamento"
          description="Os pagamentos registrados aparecerão aqui."
        />
      ) : null}
      {payments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <p className="font-medium">
                      {payment.externalReference ?? payment.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {payment.tenantName ?? payment.invoiceId}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(payment.status)}>
                      {statusLabel(payment.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusLabel(payment.method)}</TableCell>
                  <TableCell>
                    {formatDate(
                      payment.paidAt ?? payment.failedAt ?? payment.createdAt,
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(payment.amountCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {paymentsQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={paymentsQuery.isFetchingNextPage}
            onClick={() => void paymentsQuery.fetchNextPage()}
          >
            {paymentsQuery.isFetchingNextPage
              ? "Carregando..."
              : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
