import { sql, type Kysely } from "kysely";
import pg from "pg";

export const databaseRoleNames = {
  runtime: "blupo_app",
  migrator: "blupo_migrator",
  provisioner: "blupo_provisioner",
} as const;

export interface DatabaseRoleBootstrapConfig {
  adminConnectionString: string;
  runtimePassword: string;
  migratorPassword: string;
  provisionerPassword: string;
  normalizeOwnership?: boolean;
}

function validatePassword(name: string, password: string): void {
  if (password.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }
}

export async function bootstrapDatabaseRoles(
  config: DatabaseRoleBootstrapConfig,
): Promise<void> {
  validatePassword("runtimePassword", config.runtimePassword);
  validatePassword("migratorPassword", config.migratorPassword);
  validatePassword("provisionerPassword", config.provisionerPassword);

  const client = new pg.Client({
    connectionString: config.adminConnectionString,
  });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT
         set_config('blupo.runtime_password', $1, true),
         set_config('blupo.migrator_password', $2, true),
         set_config('blupo.provisioner_password', $3, true)`,
      [
        config.runtimePassword,
        config.migratorPassword,
        config.provisionerPassword,
      ],
    );
    await client.query(`
      DO $roles$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blupo_app') THEN
          CREATE ROLE blupo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blupo_migrator') THEN
          CREATE ROLE blupo_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blupo_provisioner') THEN
          CREATE ROLE blupo_provisioner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
        END IF;

        ALTER ROLE blupo_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
        ALTER ROLE blupo_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
        ALTER ROLE blupo_provisioner WITH LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

        EXECUTE format('ALTER ROLE blupo_app PASSWORD %L', current_setting('blupo.runtime_password'));
        EXECUTE format('ALTER ROLE blupo_migrator PASSWORD %L', current_setting('blupo.migrator_password'));
        EXECUTE format('ALTER ROLE blupo_provisioner PASSWORD %L', current_setting('blupo.provisioner_password'));
      END
      $roles$;
    `);
    await client.query(`
      DO $database_grants$
      BEGIN
        EXECUTE format(
          'GRANT CONNECT ON DATABASE %I TO blupo_app, blupo_migrator, blupo_provisioner',
          current_database()
        );
        EXECUTE format(
          'GRANT CREATE ON DATABASE %I TO blupo_migrator',
          current_database()
        );
      END
      $database_grants$;

      REVOKE ALL ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO blupo_app, blupo_migrator;
      GRANT CREATE ON SCHEMA public TO blupo_migrator;

      DO $pgvector$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
        ) THEN
          CREATE EXTENSION IF NOT EXISTS vector;
        END IF;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'pgvector extension cannot be created with current role';
      END
      $pgvector$;

      CREATE SCHEMA IF NOT EXISTS qa_ AUTHORIZATION blupo_migrator;
      GRANT USAGE, CREATE ON SCHEMA qa_ TO blupo_migrator;
      GRANT USAGE ON SCHEMA qa_ TO blupo_app;
    `);

    if (config.normalizeOwnership ?? true) {
      await client.query(`
        DO $ownership$
        DECLARE
          object_record record;
          function_record record;
        BEGIN
          FOR object_record IN
            SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
              AND NOT EXISTS (
                SELECT 1
                FROM pg_depend d
                WHERE d.classid = 'pg_class'::regclass
                  AND d.objid = c.oid
                  AND d.deptype = 'e'
              )
          LOOP
            IF object_record.relkind IN ('r', 'p') THEN
              EXECUTE format('ALTER TABLE %I.%I OWNER TO blupo_migrator', object_record.schema_name, object_record.object_name);
            ELSIF object_record.relkind = 'S' THEN
              EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO blupo_migrator', object_record.schema_name, object_record.object_name);
            ELSIF object_record.relkind = 'v' THEN
              EXECUTE format('ALTER VIEW %I.%I OWNER TO blupo_migrator', object_record.schema_name, object_record.object_name);
            ELSIF object_record.relkind = 'm' THEN
              EXECUTE format('ALTER MATERIALIZED VIEW %I.%I OWNER TO blupo_migrator', object_record.schema_name, object_record.object_name);
            END IF;
          END LOOP;

          FOR function_record IN
            SELECT
              n.nspname AS schema_name,
              p.proname AS function_name,
              pg_get_function_identity_arguments(p.oid) AS arguments
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prokind = 'f'
              AND NOT EXISTS (
                SELECT 1
                FROM pg_depend d
                WHERE d.classid = 'pg_proc'::regclass
                  AND d.objid = p.oid
                  AND d.deptype = 'e'
              )
          LOOP
            EXECUTE format(
              'ALTER FUNCTION %I.%I(%s) OWNER TO blupo_migrator',
              function_record.schema_name,
              function_record.function_name,
              function_record.arguments
            );
          END LOOP;
        END
        $ownership$;
      `);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function grantRuntimePrivileges<DB>(
  db: Kysely<DB>,
): Promise<boolean> {
  const roleResult = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM pg_roles WHERE rolname = ${databaseRoleNames.runtime}
    ) AS exists
  `.execute(db);

  if (!roleResult.rows[0]?.exists) return false;

  await sql`
    DO $grants$
    DECLARE
      object_record record;
      schema_name text;
      app_schemas text[] := ARRAY(
        SELECT nspname FROM pg_namespace WHERE nspname IN ('public', 'qa_')
      );
    BEGIN
      FOR object_record IN
        SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY (app_schemas)
          AND c.relkind IN ('r', 'p', 'v', 'm')
          AND c.relname NOT LIKE 'kysely_migration%'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_depend d
            WHERE d.classid = 'pg_class'::regclass
              AND d.objid = c.oid
              AND d.deptype = 'e'
          )
      LOOP
        IF object_record.relkind IN ('r', 'p') THEN
          IF object_record.object_name IN ('audit_logs', 'platform_audit_logs')
             OR (object_record.schema_name = 'qa_' AND object_record.object_name = 'audit_log') THEN
            EXECUTE format(
              'REVOKE UPDATE, DELETE ON TABLE %I.%I FROM blupo_app',
              object_record.schema_name,
              object_record.object_name
            );
            EXECUTE format(
              'GRANT SELECT, INSERT ON TABLE %I.%I TO blupo_app',
              object_record.schema_name,
              object_record.object_name
            );
          ELSE
            EXECUTE format(
              'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO blupo_app',
              object_record.schema_name,
              object_record.object_name
            );
          END IF;
        ELSE
          EXECUTE format(
            'GRANT SELECT ON TABLE %I.%I TO blupo_app',
            object_record.schema_name,
            object_record.object_name
          );
        END IF;
      END LOOP;

      FOR object_record IN
        SELECT n.nspname AS schema_name, c.relname AS object_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY (app_schemas)
          AND c.relkind = 'S'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_depend d
            WHERE d.classid = 'pg_class'::regclass
              AND d.objid = c.oid
              AND d.deptype = 'e'
          )
      LOOP
        EXECUTE format(
          'GRANT USAGE, SELECT ON SEQUENCE %I.%I TO blupo_app',
          object_record.schema_name,
          object_record.object_name
        );
      END LOOP;

      FOREACH schema_name IN ARRAY app_schemas LOOP
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC', schema_name);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC', schema_name);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', schema_name);
      END LOOP;

      IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'update_updated_at_column'
      ) THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO blupo_app';
      END IF;
    END
    $grants$;
  `.execute(db);

  return true;
}
