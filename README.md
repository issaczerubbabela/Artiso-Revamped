# Artiso

A cross-platform reference preparation tool for artists. See
[`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/) for the full architecture,
phase plan, and design language.

## Development

```
pnpm install       # install all workspace packages
pnpm dev           # boot apps/web at http://localhost:3000
pnpm build         # static export of apps/web (and typecheck of packages)
pnpm test          # headless unit tests (shared-types, core-engine, renderer, ui, api-client)
pnpm lint          # eslint across the monorepo
pnpm typecheck     # tsc --noEmit across the monorepo
pnpm --filter web exec playwright test   # E2E smoke test
pnpm --filter @artiso/ui preview:dev     # design-token preview at compact/regular/wide
```

## Supabase setup (manual, Phase 0)

1. Create a free project at supabase.com/dashboard.
2. Project Settings → API → copy the Project URL and `anon` public key.
3. SQL editor → run:
   ```sql
   create table smoke_test (
     id uuid primary key default gen_random_uuid(),
     label text not null,
     created_at timestamptz not null default now()
   );
   insert into smoke_test (label) values ('phase-0-smoke-test');
   ```
4. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the two
   values (gitignored, never commit).
