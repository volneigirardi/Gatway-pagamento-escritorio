import type { Generated } from "kysely";

export interface TenantDatabase {
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
  audit_logs: {
    id: Generated<string>;
    tenant_id: string;
    actor_id: string | null;
    action: string;
    resource: string;
    resource_id: string | null;
    before_state: unknown;
    after_state: unknown;
    ip_address: string | null;
    user_agent: string | null;
    correlation_id: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
  outbox: {
    id: Generated<string>;
    tenant_id: string;
    type: string;
    event_version: Generated<string>;
    aggregate_id: string;
    aggregate_type: string;
    payload: unknown;
    metadata: unknown;
    created_at: Generated<Date>;
    processed_at: Date | null;
    updated_at: Generated<Date>;
    deleted_at: Date | null;
  };
}
