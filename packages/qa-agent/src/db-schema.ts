import { type Generated } from "kysely";

export interface QaEntity {
  id: Generated<string>;
  type: string;
  name: string;
  slug: string;
  description: string | null;
  source_sha: string | null;
  file_path: string | null;
  line_range: string | null;
  metadata: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface QaRelation {
  id: Generated<string>;
  source_id: string;
  target_id: string;
  relation_type: string;
  confidence: Generated<number>;
  inferred: Generated<boolean>;
  source_sha: string | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaMemoryItem {
  id: Generated<string>;
  kind: string;
  change_id: string | null;
  source_sha: string | null;
  scope: string | null;
  environment: string | null;
  title: string;
  content: string | null;
  content_hash: string;
  metadata: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface QaTestRun {
  id: Generated<string>;
  change_id: string | null;
  source_sha: string;
  base_sha: string | null;
  scope: string;
  environment: string;
  status: string;
  duration_ms: number | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaTestResult {
  id: Generated<string>;
  test_run_id: string;
  command: string;
  exit_code: number;
  status: string;
  duration_ms: number | null;
  output: string | null;
  error: string | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaDefect {
  id: Generated<string>;
  change_id: string | null;
  severity: string;
  title: string;
  description: string | null;
  file_path: string | null;
  line_range: string | null;
  status: Generated<string>;
  metadata: unknown;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface QaFixAttempt {
  id: Generated<string>;
  defect_id: string;
  source_sha: string;
  status: string;
  result: string | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaRelease {
  id: Generated<string>;
  source_sha: string;
  artifact_digest: string | null;
  status: string;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaReleaseGate {
  id: Generated<string>;
  release_id: string;
  gate_name: string;
  status: string;
  evidence: string | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaEmbedding {
  id: Generated<string>;
  memory_item_id: string;
  model: string;
  dimensions: number;
  vector_jsonb: unknown;
  vector: number[] | null;
  created_at: Generated<Date>;
}

export interface QaFingerprint {
  id: Generated<string>;
  change_id: string | null;
  source_sha: string;
  lockfile_hash: string | null;
  migration_hash: string | null;
  config_hash: string | null;
  test_version: string | null;
  fixture_hash: string | null;
  env_fingerprint: string | null;
  browser: string | null;
  affected_closure: unknown;
  result_status: string;
  result_id: string | null;
  expires_at: Date | null;
  metadata: unknown;
  created_at: Generated<Date>;
}

export interface QaAuditLog {
  id: Generated<string>;
  operation: string;
  table_name: string;
  record_id: string | null;
  actor: string | null;
  change_summary: unknown;
  created_at: Generated<Date>;
}

export interface QaDatabase {
  "qa_.entities": QaEntity;
  "qa_.relations": QaRelation;
  "qa_.memory_items": QaMemoryItem;
  "qa_.test_runs": QaTestRun;
  "qa_.test_results": QaTestResult;
  "qa_.defects": QaDefect;
  "qa_.fix_attempts": QaFixAttempt;
  "qa_.releases": QaRelease;
  "qa_.release_gates": QaReleaseGate;
  "qa_.embeddings": QaEmbedding;
  "qa_.fingerprints": QaFingerprint;
  "qa_.audit_log": QaAuditLog;
}

export type QaTableName = keyof QaDatabase;
