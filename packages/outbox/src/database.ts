export interface OutboxDatabase {
  outbox: {
    id: string;
    tenant_id: string;
    aggregate_type: string;
    aggregate_id: string;
    type: string;
    payload: unknown;
    metadata: unknown;
    created_at: string;
    processed_at: string | null;
  };
}
