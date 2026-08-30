const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

const labels: Record<string, string> = {
  active: "Ativo",
  trialing: "Em teste",
  pending: "Pendente",
  past_due: "Em atraso",
  suspended: "Suspenso",
  canceled: "Cancelado",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  open: "Em aberto",
  overdue: "Vencida",
  void: "Anulada",
  draft: "Rascunho",
  archived: "Arquivado",
  provisioning: "Provisionando",
  pending_admin: "Aguardando administrador",
  completed: "Concluído",
  queued: "Na fila",
  running: "Em andamento",
  not_started: "Não iniciado",
  manual: "Manual",
  pix: "Pix",
  bank_transfer: "Transferência bancária",
  card: "Cartão",
  boleto: "Boleto",
  other: "Outro",
};

export function statusLabel(status: string): string {
  return labels[status] ?? status;
}

export function statusVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" | "outline" {
  if (["active", "paid", "completed"].includes(status)) return "success";
  if (
    [
      "pending",
      "trialing",
      "open",
      "queued",
      "running",
      "provisioning",
    ].includes(status)
  ) {
    return "warning";
  }
  if (
    ["failed", "overdue", "past_due", "suspended", "canceled"].includes(status)
  ) {
    return "destructive";
  }
  if (["draft", "archived", "void", "refunded"].includes(status))
    return "secondary";
  return "outline";
}
