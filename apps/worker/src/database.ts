import type { Generated } from "kysely";

export interface WorkerAdminDatabase {
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
    plan: Generated<string>;
    plan_id: string | null;
    created_by_identity_id: string | null;
    status:
      | "draft"
      | "provisioning"
      | "pending_admin"
      | "active"
      | "suspended"
      | "failed"
      | "archived";
    provisioning_status:
      "not_started" | "queued" | "running" | "completed" | "failed";
    activated_at: Date | null;
    last_error_code: string | null;
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
    deleted_at: Date | null;
  };
  plans: {
    id: Generated<string>;
    name: string;
    slug: string;
    status: Generated<"draft" | "active" | "archived">;
    trial_days: Generated<number>;
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
  };
  subscriptions: {
    id: Generated<string>;
    tenant_id: string;
    plan_id: string;
    plan_price_id: string;
    currency: string;
    billing_interval: "monthly" | "yearly";
    amount_cents: string;
    status:
      "pending" | "trialing" | "active" | "past_due" | "suspended" | "canceled";
    trial_ends_at: Date | null;
    canceled_at: Date | null;
    current_period_start: Date;
    current_period_end: Date;
    deleted_at: Date | null;
    updated_at: Generated<Date>;
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

export interface WorkerTenantDatabase {
  users: {
    id: Generated<string>;
    tenant_id: string;
    identity_id: string;
    email: string;
    normalized_email: string;
    display_name: string;
    status: Generated<"active" | "disabled">;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  roles: {
    id: Generated<string>;
    tenant_id: string;
    name: string;
    slug: string;
    description: string | null;
    reserved: Generated<boolean>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  permissions: {
    id: Generated<string>;
    tenant_id: string;
    key: string;
    description: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  user_roles: {
    id: Generated<string>;
    tenant_id: string;
    user_id: string;
    role_id: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  role_permissions: {
    id: Generated<string>;
    tenant_id: string;
    role_id: string;
    permission_id: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  company_settings: {
    id: Generated<string>;
    tenant_id: string;
    legal_name: string | null;
    trade_name: string | null;
    tax_id: string | null;
    contact_email: string | null;
    timezone: Generated<string>;
    locale: Generated<string>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
}
