# PostgreSQL Query Plan Baselines

Store evidence for non-trivial query and index changes here. Use one directory or Markdown file per query/use case.

Each baseline must include:

- query name and owning module;
- sanitized, parameterized query shape;
- PostgreSQL version and representative dataset size/distribution;
- before/after `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output from a safe non-production environment;
- execution time, planning time, rows estimated/actual, buffer hits/reads, sorts/spills, and relevant locks;
- index/storage/write-amplification impact;
- conclusion, regression threshold, and date;
- final `postgres-dba` verdict or reference to the task/PR review.

Never include production data, secrets, credentials, or raw sensitive values. Never run mutating or expensive `EXPLAIN ANALYZE` in production without explicit approval and an operationally safe plan.
