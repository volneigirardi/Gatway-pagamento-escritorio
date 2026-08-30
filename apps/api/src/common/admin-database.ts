import type { ColumnType, Generated } from "kysely";

export interface AdminDatabase {
  identities: {
    id: Generated<string>;
    email: string;
    display_name: string | null;
    normalized_email: string;
    password_hash: string;
    realm: "platform" | "tenant";
    tenant_id: string | null;
    status: "pending" | "active" | "locked" | "disabled";
    must_change_password: Generated<boolean>;
    mfa_required: Generated<boolean>;
    password_changed_at: Date | null;
    last_login_at: Date | null;
    locked_until: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  mfa_factors: {
    id: Generated<string>;
    identity_id: string;
    type: Generated<"totp">;
    secret_ciphertext: string;
    last_used_step: string | null;
    enabled_at: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  mfa_backup_codes: {
    id: Generated<string>;
    factor_id: string;
    code_hash: string;
    used_at: Date | null;
    created_at: Generated<Date>;
  };
  tenants: {
    id: Generated<string>;
    name: string;
    slug: string;
    legal_name: string | null;
    trade_name: string | null;
    tax_id: string | null;
    contact_email: string | null;
    database_name: string | null;
    database_host: string | null;
    database_port: number | null;
    status: Generated<
      | "draft"
      | "provisioning"
      | "pending_admin"
      | "active"
      | "suspended"
      | "failed"
      | "archived"
    >;
    plan: Generated<string>;
    plan_id: string | null;
    provisioning_status: Generated<
      "not_started" | "queued" | "running" | "completed" | "failed"
    >;
    created_by_identity_id: string | null;
    activated_at: Date | null;
    suspended_at: Date | null;
    last_error_code: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  plans: {
    id: Generated<string>;
    name: string;
    slug: string;
    description: string | null;
    status: Generated<"draft" | "active" | "archived">;
    trial_days: Generated<number>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  plan_prices: {
    id: Generated<string>;
    plan_id: string;
    currency: Generated<string>;
    billing_interval: "monthly" | "yearly";
    amount_cents: string;
    effective_from: Generated<Date>;
    effective_to: Date | null;
    created_at: Generated<Date>;
  };
  plan_features: {
    id: Generated<string>;
    plan_id: string;
    key: string;
    value: unknown;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  subscriptions: {
    id: Generated<string>;
    tenant_id: string;
    plan_id: string;
    plan_price_id: string;
    status:
      "pending" | "trialing" | "active" | "past_due" | "suspended" | "canceled";
    currency: string;
    billing_interval: "monthly" | "yearly";
    amount_cents: string;
    current_period_start: Date;
    current_period_end: Date;
    trial_ends_at: Date | null;
    canceled_at: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  invoices: {
    id: Generated<string>;
    tenant_id: string;
    subscription_id: string;
    number: string;
    status: Generated<"draft" | "open" | "paid" | "overdue" | "void">;
    currency: Generated<string>;
    subtotal_cents: string;
    discount_cents: Generated<string>;
    tax_cents: Generated<string>;
    total_cents: string;
    due_date: ColumnType<string | Date, string, string>;
    issued_at: Date | null;
    paid_at: Date | null;
    voided_at: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  invoice_items: {
    id: Generated<string>;
    invoice_id: string;
    description: string;
    quantity: Generated<number>;
    unit_amount_cents: string;
    total_cents: string;
    created_at: Generated<Date>;
  };
  payments: {
    id: Generated<string>;
    tenant_id: string;
    invoice_id: string;
    provider: Generated<string>;
    external_reference: string | null;
    method: "manual" | "bank_transfer" | "pix" | "card" | "other";
    status: Generated<"pending" | "paid" | "failed" | "refunded" | "canceled">;
    currency: Generated<string>;
    amount_cents: string;
    failure_code: string | null;
    paid_at: Date | null;
    failed_at: Date | null;
    refunded_at: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  tenant_provisioning_attempts: {
    id: Generated<string>;
    tenant_id: string;
    job_key: string;
    status: "queued" | "running" | "completed" | "failed";
    attempt: Generated<number>;
    error_code: string | null;
    error_detail: string | null;
    started_at: Date | null;
    completed_at: Date | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  platform_outbox: {
    id: Generated<string>;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    event_version: Generated<string>;
    payload: unknown;
    metadata: Generated<unknown>;
    attempts: Generated<number>;
    created_at: Generated<Date>;
    processed_at: Date | null;
  };
  platform_idempotency_keys: {
    id: Generated<string>;
    actor_identity_id: string | null;
    scope: string;
    key: string;
    request_hash: string;
    status: Generated<"pending" | "completed" | "failed">;
    response_status: number | null;
    response: unknown;
    expires_at: Date;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  platform_roles: {
    id: Generated<string>;
    name: string;
    slug: string;
    description: string | null;
    reserved: Generated<boolean>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  platform_permissions: {
    id: Generated<string>;
    key: string;
    description: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  platform_identity_roles: {
    id: Generated<string>;
    identity_id: string;
    role_id: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  platform_role_permissions: {
    id: Generated<string>;
    role_id: string;
    permission_id: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  platform_audit_logs: {
    id: Generated<string>;
    actor_identity_id: string | null;
    action: string;
    resource: string;
    resource_id: string | null;
    tenant_id: string | null;
    metadata: Generated<unknown>;
    ip_address: string | null;
    user_agent: string | null;
    request_id: string | null;
    correlation_id: string | null;
    created_at: Generated<Date>;
  };
}
