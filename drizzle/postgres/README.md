# Database migration history

- `drizzle/0000_*.sql` through `drizzle/0006_*.sql` and `drizzle/meta/` are preserved legacy MySQL history. Do not apply them to PostgreSQL.
- `drizzle/postgres/` is the active PostgreSQL migration directory. `0000_true_genesis.sql` is the fresh baseline for a future Supabase Postgres database.

Generate future PostgreSQL migrations with `corepack pnpm db:generate`. Migration tooling requires `DATABASE_DIRECT_URL`; application runtime uses only `DATABASE_URL`.

Generation does not apply migrations or require a database connection. Applying this baseline is a separate, explicitly approved future operation.
