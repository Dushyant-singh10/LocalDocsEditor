# E2E tests

These specs exercise the hard requirements end-to-end: offline editing, sync-server role
enforcement, and version restore under a concurrent edit. They need the full stack running,
which a CI job can't do yet without a disposable Postgres + seeded OAuth session, so they are
**not** part of `pnpm -r test` or the CI workflow — run them manually:

```bash
# 1. Postgres reachable via DATABASE_URL, migrations applied
pnpm --filter @local-first-docs/db migrate

# 2. In separate terminals
pnpm dev        # apps/web on :3000
pnpm dev:sync   # apps/sync-server on :1234 / :1235

# 3. Seed two authenticated browser storage states (see auth.setup.ts) so specs
#    don't have to drive the real GitHub OAuth flow, then:
pnpm --filter web test:e2e
```

Each spec documents the storage-state / seed data it assumes at the top of the file.
