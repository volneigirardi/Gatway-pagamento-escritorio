import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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
import { formatDate, statusLabel, statusVariant } from "../lib/format.js";
import { formString } from "../lib/form.js";
import { useAuth } from "../lib/use-auth.js";
import { useDebouncedValue } from "../lib/use-debounced-value.js";

export default function PlatformCompanies(): ReactElement {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminTenant, setAdminTenant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const plansQuery = useQuery({
    queryKey: ["platform", "plans", "active", "company-form"],
    queryFn: () => platformApi.plans({ status: "active", limit: 100 }),
  });
  const tenantsQuery = useInfiniteQuery({
    queryKey: ["platform", "tenants", status, debouncedSearch],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      platformApi.tenants({
        status,
        search: debouncedSearch,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const createMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const planPrice = formString(form, "planPrice");
      const [planId, planPriceId] = planPrice.split(":");
      const tenant = await platformApi.createTenant({
        name: formString(form, "name"),
        slug: formString(form, "slug"),
        legalName: formString(form, "legalName") || undefined,
        tradeName: formString(form, "tradeName") || undefined,
        taxId: formString(form, "taxId") || undefined,
        contactEmail: formString(form, "contactEmail"),
        planId,
        planPriceId,
      });
      let provisioned = tenant;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (
          provisioned.status === "pending_admin" &&
          provisioned.provisioningStatus === "completed"
        ) {
          break;
        }
        if (provisioned.status === "failed") {
          throw new Error("Tenant provisioning failed");
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2000);
        });
        provisioned = await platformApi.tenant(tenant.id);
      }
      if (
        provisioned.status !== "pending_admin" ||
        provisioned.provisioningStatus !== "completed"
      ) {
        throw new Error("Tenant provisioning timed out");
      }
      await platformApi.createTenantAdmin(tenant.id, {
        displayName: formString(form, "adminName"),
        email: formString(form, "adminEmail"),
        temporaryPassword: formString(form, "temporaryPassword"),
      });
      return provisioned;
    },
    onSuccess: async () => {
      setDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["platform", "tenants"],
      });
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "tenants"],
      });
    },
  });
  const adminMutation = useMutation({
    mutationFn: ({ tenantId, form }: { tenantId: string; form: FormData }) =>
      platformApi.createTenantAdmin(tenantId, {
        displayName: formString(form, "adminName"),
        email: formString(form, "adminEmail"),
        temporaryPassword: formString(form, "temporaryPassword"),
      }),
    onSuccess: async () => {
      setAdminTenant(null);
      await queryClient.invalidateQueries({
        queryKey: ["platform", "tenants"],
      });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: "active" | "suspended";
    }) => platformApi.updateTenantStatus(id, nextStatus),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] }),
  });
  const tenants = tenantsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const plans = plansQuery.data?.items ?? [];
  const canWrite =
    auth.status === "authenticated" &&
    auth.session.user.permissions.includes("platform:tenants:write");

  const createCompany: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    createMutation.mutate(new FormData(event.currentTarget));
  };
  const completeAdministrator: SubmitEventHandler<HTMLFormElement> = (
    event,
  ) => {
    event.preventDefault();
    if (!adminTenant) return;
    adminMutation.mutate({
      tenantId: adminTenant.id,
      form: new FormData(event.currentTarget),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Cadastre clientes, acompanhe o provisionamento e controle o acesso."
        actions={
          canWrite ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nova empresa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <form onSubmit={createCompany} className="space-y-6">
                  <DialogHeader>
                    <DialogTitle>Cadastrar empresa</DialogTitle>
                    <DialogDescription>
                      A empresa será ativada somente após o provisionamento e a
                      criação do administrador.
                    </DialogDescription>
                  </DialogHeader>
                  {createMutation.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Cadastro não concluído</AlertTitle>
                      <AlertDescription>
                        Revise os dados. Se a empresa já aparecer como
                        aguardando administrador, finalize o acesso pela lista.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <fieldset className="grid gap-4 sm:grid-cols-2">
                    <legend className="mb-3 text-sm font-semibold sm:col-span-2">
                      Dados da empresa
                    </legend>
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nome</Label>
                      <Input
                        id="company-name"
                        name="name"
                        maxLength={255}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-slug">Identificador</Label>
                      <Input
                        id="company-slug"
                        name="slug"
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder="empresa-exemplo"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legal-name">Razão social</Label>
                      <Input id="legal-name" name="legalName" maxLength={255} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trade-name">Nome fantasia</Label>
                      <Input id="trade-name" name="tradeName" maxLength={255} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax-id">CNPJ</Label>
                      <Input
                        id="tax-id"
                        name="taxId"
                        inputMode="numeric"
                        pattern="[0-9]{14}"
                        maxLength={14}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-mail de contato</Label>
                      <Input
                        id="contact-email"
                        name="contactEmail"
                        type="email"
                        maxLength={320}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="company-plan">Plano e cobrança</Label>
                      <Select name="planPrice" required>
                        <SelectTrigger id="company-plan">
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.flatMap((plan) =>
                            plan.prices
                              .filter((price) => price.effectiveTo === null)
                              .map((price) => (
                                <SelectItem
                                  key={price.id}
                                  value={`${plan.id}:${price.id}`}
                                >
                                  {plan.name} —{" "}
                                  {price.billingInterval === "monthly"
                                    ? "mensal"
                                    : "anual"}
                                </SelectItem>
                              )),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </fieldset>
                  <fieldset className="grid gap-4 sm:grid-cols-2">
                    <legend className="mb-3 text-sm font-semibold sm:col-span-2">
                      Administrador inicial
                    </legend>
                    <div className="space-y-2">
                      <Label htmlFor="admin-name">Nome completo</Label>
                      <Input
                        id="admin-name"
                        name="adminName"
                        maxLength={160}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">E-mail de acesso</Label>
                      <Input
                        id="admin-email"
                        name="adminEmail"
                        type="email"
                        maxLength={320}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="temporary-password">
                        Senha temporária
                      </Label>
                      <Input
                        id="temporary-password"
                        name="temporaryPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        required
                      />
                      <p className="text-xs text-text-muted">
                        A senha será enviada somente nesta solicitação e deverá
                        ser alterada no primeiro acesso.
                      </p>
                    </div>
                  </fieldset>
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
                      disabled={createMutation.isPending || plans.length === 0}
                    >
                      {createMutation.isPending
                        ? "Cadastrando..."
                        : "Cadastrar e provisionar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <Dialog
        open={adminTenant !== null}
        onOpenChange={(open) => {
          if (!open) setAdminTenant(null);
        }}
      >
        <DialogContent>
          <form onSubmit={completeAdministrator} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Finalizar administrador</DialogTitle>
              <DialogDescription>
                Crie o acesso inicial de {adminTenant?.name ?? "esta empresa"}.
              </DialogDescription>
            </DialogHeader>
            {adminMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Administrador não criado</AlertTitle>
                <AlertDescription>
                  Verifique se o e-mail já pertence a outra conta e tente
                  novamente.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="pending-admin-name">Nome completo</Label>
              <Input
                id="pending-admin-name"
                name="adminName"
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pending-admin-email">E-mail de acesso</Label>
              <Input
                id="pending-admin-email"
                name="adminEmail"
                type="email"
                maxLength={320}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pending-admin-password">Senha temporária</Label>
              <Input
                id="pending-admin-password"
                name="temporaryPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAdminTenant(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={adminMutation.isPending}>
                {adminMutation.isPending ? "Criando..." : "Criar administrador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            aria-label="Buscar empresas"
            placeholder="Buscar por nome, slug ou e-mail"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={status || "all"}
          onValueChange={(value) => {
            setStatus(value === "all" ? "" : value);
          }}
        >
          <SelectTrigger
            className="sm:w-52"
            aria-label="Filtrar empresas por status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="provisioning">Provisionando</SelectItem>
            <SelectItem value="suspended">Suspensas</SelectItem>
            <SelectItem value="failed">Com falha</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {tenantsQuery.isLoading ? <PageLoading /> : null}
      {tenantsQuery.isError ? (
        <QueryError retry={() => void tenantsQuery.refetch()} />
      ) : null}
      {!tenantsQuery.isLoading &&
      !tenantsQuery.isError &&
      tenants.length === 0 ? (
        <EmptyState
          title="Nenhuma empresa encontrada"
          description="Ajuste os filtros ou cadastre a primeira empresa."
        />
      ) : null}
      {tenants.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provisionamento</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <p className="font-medium">
                      {tenant.tradeName ?? tenant.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {tenant.contactEmail}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tenant.status)}>
                      {statusLabel(tenant.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tenant.provisioningStatus)}>
                      {statusLabel(tenant.provisioningStatus)}
                    </Badge>
                    {tenant.lastErrorCode ? (
                      <p className="mt-1 text-xs text-error-600">
                        Código: {tenant.lastErrorCode}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && tenant.status === "pending_admin" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAdminTenant({ id: tenant.id, name: tenant.name });
                        }}
                      >
                        Criar administrador
                      </Button>
                    ) : null}
                    {canWrite && tenant.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={statusMutation.isPending}
                        onClick={() => {
                          statusMutation.mutate({
                            id: tenant.id,
                            nextStatus: "suspended",
                          });
                        }}
                      >
                        Suspender
                      </Button>
                    ) : null}
                    {canWrite && tenant.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() => {
                          statusMutation.mutate({
                            id: tenant.id,
                            nextStatus: "active",
                          });
                        }}
                      >
                        Reativar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {tenantsQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={tenantsQuery.isFetchingNextPage}
            onClick={() => void tenantsQuery.fetchNextPage()}
          >
            {tenantsQuery.isFetchingNextPage
              ? "Carregando..."
              : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
