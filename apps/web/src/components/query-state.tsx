import { AlertCircle, Inbox } from "lucide-react";
import type { ReactElement } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Skeleton,
} from "@saas/ui-web";

export function PageLoading(): ReactElement {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando conteúdo">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function QueryError({ retry }: { retry: () => void }): ReactElement {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Não foi possível carregar os dados</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Tente novamente. Se o problema continuar, entre em contato com o
          suporte.
        </span>
        <Button variant="outline" size="sm" onClick={retry}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactElement {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-text-muted" aria-hidden="true" />
      <h2 className="font-semibold text-text">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>
    </div>
  );
}
