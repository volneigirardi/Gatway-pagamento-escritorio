import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement, type SubmitEventHandler } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saas/ui-web";
import { PageLoading, QueryError } from "../components/query-state.js";
import { tenantApi } from "../lib/api.js";
import { formString } from "../lib/form.js";
import { useAuth } from "../lib/use-auth.js";

export default function TenantSettings(): ReactElement {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["tenant", "settings"],
    queryFn: () => tenantApi.settings(),
  });
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      tenantApi.updateSettings({
        legalName: formString(form, "legalName") || null,
        tradeName: formString(form, "tradeName") || null,
        contactEmail: formString(form, "contactEmail") || null,
        timezone: formString(form, "timezone", "America/Sao_Paulo"),
        locale: formString(form, "locale", "pt-BR"),
      }),
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant", "overview"] }),
      ]);
    },
  });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return <QueryError retry={() => void query.refetch()} />;
  const canWrite =
    auth.status === "authenticated" &&
    auth.session.user.permissions.includes("company:update");
  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setSaved(false);
    mutation.mutate(new FormData(event.currentTarget));
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresa"
        description="Mantenha os dados básicos usados no seu ambiente."
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
          <CardDescription>
            O CNPJ é controlado pela plataforma e não pode ser alterado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            {saved ? (
              <Alert variant="success">
                <AlertTitle>Configurações salvas</AlertTitle>
                <AlertDescription>
                  Os novos dados já estão disponíveis no ambiente.
                </AlertDescription>
              </Alert>
            ) : null}
            {mutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Alteração não salva</AlertTitle>
                <AlertDescription>
                  Revise os campos e tente novamente.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-legal-name">Razão social</Label>
                <Input
                  id="tenant-legal-name"
                  name="legalName"
                  defaultValue={query.data.legalName ?? ""}
                  maxLength={160}
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-trade-name">Nome fantasia</Label>
                <Input
                  id="tenant-trade-name"
                  name="tradeName"
                  defaultValue={query.data.tradeName ?? ""}
                  maxLength={120}
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-tax-id">CNPJ</Label>
                <Input
                  id="tenant-tax-id"
                  value={query.data.taxId ?? ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-contact-email">E-mail de contato</Label>
                <Input
                  id="tenant-contact-email"
                  name="contactEmail"
                  type="email"
                  defaultValue={query.data.contactEmail ?? ""}
                  maxLength={320}
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-timezone">Fuso horário</Label>
                <Select
                  name="timezone"
                  defaultValue={query.data.timezone}
                  disabled={!canWrite}
                >
                  <SelectTrigger id="tenant-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">Brasília</SelectItem>
                    <SelectItem value="America/Manaus">Manaus</SelectItem>
                    <SelectItem value="America/Rio_Branco">
                      Rio Branco
                    </SelectItem>
                    <SelectItem value="America/Noronha">
                      Fernando de Noronha
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-locale">Idioma</Label>
                <Select
                  name="locale"
                  defaultValue={query.data.locale}
                  disabled={!canWrite}
                >
                  <SelectTrigger id="tenant-locale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {canWrite ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
