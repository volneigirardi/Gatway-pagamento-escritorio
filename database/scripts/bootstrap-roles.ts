import { hydrateFileEnvironment } from "@saas/config";
import { bootstrapDatabaseRoles } from "@saas/database";

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

async function main(): Promise<void> {
  hydrateFileEnvironment();
  await bootstrapDatabaseRoles({
    adminConnectionString: requireEnvironment("DATABASE_ADMIN_URL"),
    runtimePassword: requireEnvironment("APP_DATABASE_PASSWORD"),
    migratorPassword: requireEnvironment("MIGRATION_DATABASE_PASSWORD"),
    provisionerPassword: requireEnvironment("PROVISIONER_DATABASE_PASSWORD"),
    normalizeOwnership: true,
  });
  console.log("PostgreSQL application roles bootstrapped successfully");
}

void main();
