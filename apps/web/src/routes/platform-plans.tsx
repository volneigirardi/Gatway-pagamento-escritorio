import {
  useInfiniteQuery,
  useMutation,
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
  Textarea,
} from "@saas/ui-web";
import {
  EmptyState,
  PageLoading,
  QueryError,
} from "../components/query-state.js";
import { platformApi } from "../lib/api.js";
import { formatMoney, statusLabel, statusVariant } from "../lib/format.js";
import { formString } from "../lib/form.js";
import { useAuth } from "../lib/use-auth.js";

export default function PlatformPlans(): ReactElement {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState("");
  const plansQuery = useInfiniteQuery({
    queryKey: ["platform", "plans", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.plans({
        status,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      platformApi.createPlan({
        name: formString(form, "name"),
        slug: formString(form, "slug"),
        description: formString(form, "description") || undefined,
        trialDays: Number(form.get("trialDays") ?? 0),
        price: {
          currency: "BRL",
          billingInterval: formString(form, "billingInterval", "monthly"),
          amountCents: Math.round(Number(form.get("amount")) * 100),
        },
        features: {
          users: Number(form.get("users") ?? 1),
          monthlyTransactions: Number(form.get("transactions") ?? 0),
        },
      }),
    onSuccess: async () => {
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["platform", "plans"] });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: "active" | "archived";
    }) => platformApi.updatePlan(id, { status: nextStatus }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["platform", "plans"] }),
  });
  const plans = plansQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const canWrite =
    auth.status === "authenticated" &&
    auth.session.user.permissions.includes("platform:plans:write");

  const createPlan: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    createMutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Configure preços, períodos de cobrança e limites comerciais."
        actions={
          canWrite ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Novo plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={createPlan} className="space-y-5">
                  <DialogHeader>
                    <DialogTitle>Criar plano</DialogTitle>
                    <DialogDescription>
                      O plano começa em rascunho e deve ser ativado após
                      revisão.
                    </DialogDescription>
                  </DialogHeader>
                  {createMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Plano não criado</AlertTitle>
                      <AlertDescription>
                        Revise os campos e tente novamente.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan-name">Nome</Label>
                      <Input
                        id="plan-name"
                        name="name"
                        required
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-slug">Identificador</Label>
                      <Input
                        id="plan-slug"
                        name="slug"
                        required
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder="professional"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-description">Descrição</Label>
                    <Textarea
                      id="plan-description"
                      name="description"
                      maxLength={500}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan-trial">Dias de teste</Label>
                      <Input
                        id="plan-trial"
                        name="trialDays"
                        type="number"
                        min={0}
                        max={90}
                        defaultValue={14}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-interval">Ciclo</Label>
                      <Select
                        name="billingInterval"
                        defaultValue="monthly"
                        required
                      >
                        <SelectTrigger id="plan-interval">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-amount">Preço (R$)</Label>
                      <Input
                        id="plan-amount"
                        name="amount"
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-users">Usuários incluídos</Label>
                      <Input
                        id="plan-users"
                        name="users"
                        type="number"
                        min={1}
                        max={1000000}
                        defaultValue={5}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="plan-transactions">
                        Transações mensais
                      </Label>
                      <Input
                        id="plan-transactions"
                        name="transactions"
                        type="number"
                        min={0}
                        max={1000000000}
                        defaultValue={1000}
                        required
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
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Criando..." : "Criar plano"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <div className="flex max-w-xs items-center gap-2">
        <Select
          value={status || "all"}
          onValueChange={(value) => {
            setStatus(value === "all" ? "" : value);
          }}
        >
          <SelectTrigger aria-label="Filtrar planos por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {plansQuery.isLoading ? <PageLoading /> : null}
      {plansQuery.isError ? (
        <QueryError retry={() => void plansQuery.refetch()} />
      ) : null}
      {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 ? (
        <EmptyState
          title="Nenhum plano encontrado"
          description="Crie o primeiro plano comercial para iniciar o cadastro de empresas."
        />
      ) : null}
      {plans.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead>Teste</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const price =
                  plan.prices.find((item) => item.effectiveTo === null) ??
                  plan.prices[0];
                return (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-text-muted">{plan.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(plan.status)}>
                        {statusLabel(plan.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {price
                        ? `${formatMoney(price.amountCents)} / ${price.billingInterval === "monthly" ? "mês" : "ano"}`
                        : "Sem preço"}
                    </TableCell>
                    <TableCell>{plan.trialDays} dias</TableCell>
                    <TableCell className="text-right">
                      {canWrite && plan.status === "draft" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() => {
                            statusMutation.mutate({
                              id: plan.id,
                              nextStatus: "active",
                            });
                          }}
                        >
                          Ativar
                        </Button>
                      ) : null}
                      {canWrite && plan.status === "active" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={statusMutation.isPending}
                          onClick={() => {
                            statusMutation.mutate({
                              id: plan.id,
                              nextStatus: "archived",
                            });
                          }}
                        >
                          Arquivar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {plansQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={plansQuery.isFetchingNextPage}
            onClick={() => void plansQuery.fetchNextPage()}
          >
            {plansQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
