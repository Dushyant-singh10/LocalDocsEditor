# Local-First Docs

A local-first, collaborative document editor with offline synchronization, deterministic
conflict resolution (CRDT via Yjs), and granular version history with safe time-travel restore.

Built for the "Fullstack Developer Fulltime Assignment 2" brief — see the design rationale for
the harder requirements (offline sync, restore-without-clobbering, anti-OOM validation) below.

## Architecture

- **Editor**: Tiptap + Yjs (`@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`).
- **Local-first storage**: `y-indexeddb` — the Yjs doc lives in IndexedDB as the primary source of
  truth; the editor opens/edits with zero blocking network calls.
- **Realtime sync**: a standalone Hocuspocus (`@hocuspocus/server`) process (`apps/sync-server`),
  since a persistent websocket server can't run on Vercel's serverless functions.
- **Auth**: Auth.js v5, GitHub OAuth. Per-document roles (Owner/Editor/Viewer) live in
  `document_collaborators` and are enforced both in Next.js API routes and in the sync-server's
  `onAuthenticate`/`beforeSync` hooks — a Viewer's write attempt is rejected at the transport
  layer (connection closed), not just hidden in the UI.
- **Database**: Postgres via Drizzle ORM (`packages/db`), shared between `apps/web` and
  `apps/sync-server`.
- **AI add-on**: one bounded feature — "what changed since this version" (Gemini via Vercel AI SDK).

See [`packages/db/src/schema.ts`](packages/db/src/schema.ts) for the full schema and
[`apps/sync-server/src/snapshot.ts`](apps/sync-server/src/snapshot.ts) for the restore algorithm
(with the anti-pattern it deliberately avoids documented inline).

### Why a separate sync-server process

Hocuspocus needs a long-lived websocket connection per client; Vercel functions are short-lived.
`apps/web` (Next.js, deployed to Vercel) and `apps/sync-server` (deployed to Render) are two
separate deployables sharing `packages/db` and `packages/shared`. `apps/web` never touches the
live in-memory Yjs document directly — version snapshotting and restore both go through a small
internal HTTP API on the sync-server (`apps/sync-server/src/internal-api.ts`, gated by a shared
secret), since only that process holds the live document.

The realtime websocket and that internal API are served from **one port** (`apps/sync-server/src/index.ts`
wires a plain `ws` `WebSocketServer` and Hocuspocus's core `Hocuspocus` class onto a single
`http.createServer`, routing upgrade requests to Hocuspocus and plain `/internal/*` POSTs to the
snapshot/restore API) — deliberately, since single-public-port hosting (Render's free tier) can't
expose two ports per service the way some platforms can.

### Restore-without-clobbering

Restoring a version does **not** call `Y.applyUpdate(liveDoc, oldSnapshot)` — that would re-add
old content alongside everything since, not revert it. Instead it applies the target version's
content as a real, minimal-diff Yjs transaction against the live document
(`@tiptap/y-tiptap`'s `prosemirrorJSONToYXmlFragment`), so a concurrent collaborator's in-flight
edit merges through the normal CRDT path instead of being overwritten. See
`apps/sync-server/src/snapshot.test.ts` for a test that reproduces exactly this scenario with two
in-memory Y.Docs.

### Anti-OOM validation

Layered, cheapest-check-first: a WebSocket `maxPayload` cap at the transport layer, a stricter
app-level per-update size cap and per-connection rate limiter in `beforeHandleMessage`/`beforeSync`
(`apps/sync-server/src/hooks/`), and a soft ceiling that flags (not blocks) unbounded document
growth in `onStoreDocument`. See `apps/sync-server/src/validation/payload-guards.ts`.

## Project structure

```
apps/web/           Next.js 16 app (UI, API routes, auth)
apps/sync-server/   Hocuspocus realtime sync process + internal snapshot/restore API
packages/db/        Drizzle schema + scoped query helpers, shared by both apps
packages/shared/    Zod schemas, role helpers, realtime-token signing, shared by both apps
```

## Local development

Requires Node 20+, pnpm 9, and a Postgres instance (a free [Neon](https://neon.tech) project
works for both `apps/web` and `apps/sync-server`).

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_GITHUB_ID/SECRET, etc. — see below
pnpm build:packages     # one-time build of packages/db and packages/shared
pnpm --filter @local-first-docs/db migrate

# in separate terminals:
pnpm dev        # apps/web on http://localhost:3000
pnpm dev:sync   # apps/sync-server on ws://localhost:1234 (websocket + internal API, same port)
```

Both apps load the **one** repo-root `.env` file directly (via `dotenv`, pointed at the repo root
in `apps/web/next.config.ts` and `apps/sync-server/src/load-env.ts`) — there's no need for a
per-app `.env.local` copy.

`packages/db` and `packages/shared` are consumed as plain built JS (not raw TS) by both apps, so
re-run `pnpm build:packages` (or `pnpm --filter <pkg> dev` for `tsc --watch`) after editing them.

### Environment variables

See [`.env.example`](.env.example) for the full list. Notably:

- **GitHub OAuth app**: create one at github.com/settings/developers, callback URL
  `http://localhost:3000/api/auth/callback/github` (or your deployed URL).
- **`REALTIME_JWT_SECRET`** and **`INTERNAL_SYNC_SECRET`**: independent shared secrets between
  `apps/web` and `apps/sync-server` — generate with `openssl rand -base64 33`. Auth.js v5's own
  session token is an encrypted JWE the sync-server can't verify directly, so a short-lived,
  separately-signed "realtime token" bridges the two (see `packages/shared/src/realtime-token.ts`).
- **`GEMINI_API_KEY`**: from aistudio.google.com/apikey, for the AI diff-summarizer.
- **`GMAIL_USER`** / **`GMAIL_APP_PASSWORD`**: for the "Share" dialog's invite email
  (`apps/web/lib/email.ts`), sent via Gmail's own SMTP relay (Nodemailer) rather than a
  transactional-email API — this is what lets it email *any* recipient with zero domain setup.
  Turn on 2-Step Verification on the Gmail account, then generate an app password at
  myaccount.google.com/apppasswords and use that (not the real account password).
- **`TEST_DATABASE_URL`** (optional): a second, disposable Postgres database for
  `packages/db`'s integration tests — never point this at your dev database. See Testing below.

## Testing

```bash
pnpm -r test          # Vitest — payload validation, restore-merge algorithm, DB queries, pure helpers
pnpm --filter web test:e2e   # Playwright — needs a running full stack, see apps/web/e2e/README.md
```

`packages/db`'s tests are real integration tests — they run every exported query function
(`createDocument`, `inviteCollaborator`, `listVersions`, etc.) against an actual Postgres, not a
mock. They're skipped cleanly (not failed) if `TEST_DATABASE_URL` isn't set, so `pnpm -r test`
stays safe to run without extra setup. To actually run them:

```bash
# once: create a throwaway database and point TEST_DATABASE_URL at it (see .env.example)
DATABASE_URL="<your TEST_DATABASE_URL>" pnpm --filter @local-first-docs/db migrate
pnpm --filter @local-first-docs/db test
```

## Deployment

Three pieces, three places: Postgres on Neon, the sync-server on Render, the Next.js app on
Vercel. Set up in that order, since each later step needs values from the one before it.

### 1. Postgres (Neon)

1. Create a free project at [neon.tech](https://neon.tech).
2. Neon gives you two connection strings — a **pooled** one (for serverless/short-lived
   connections) and a **direct/unpooled** one (for long-lived processes). Use the pooled string
   for `apps/web` (Vercel functions) and the direct string for `apps/sync-server` (it holds one
   long-lived connection instead of opening/closing per request).
3. Run migrations against it once, from your machine:
   ```bash
   DATABASE_URL="<neon direct connection string>" pnpm --filter @local-first-docs/db migrate
   ```

### 2. Sync-server (Render)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo. Render reads [`render.yaml`](render.yaml)
   at the repo root and creates the `local-first-docs-sync` web service from
   `apps/sync-server/Dockerfile`, using the repo root as the Docker build context (needed so the
   build can see `packages/db` and `packages/shared`).
3. When prompted (or after, in the service's **Environment** tab), set:
   - `DATABASE_URL` → Neon's **direct/unpooled** connection string.
   - `REALTIME_JWT_SECRET`, `INTERNAL_SYNC_SECRET` → generate with `openssl rand -base64 33`
     each. Save these — `apps/web` needs the *exact same values*.
   - Leave `PORT` unset — Render injects it automatically and the app already reads
     `process.env.PORT`.
4. Note the service's public URL, e.g. `https://local-first-docs-sync.onrender.com`. The
   websocket endpoint is the same host with `wss://` instead of `https://`.
5. Free-tier caveat: Render's free web services spin down after ~15 minutes idle and cold-start
   on the next request/connection — acceptable for a demo, worth knowing if a reviewer hits a
   slow first connection.

### 3. Web app (Vercel)

1. Import the repo into Vercel. Set **Root Directory** to `apps/web` — Vercel's monorepo
   detection picks up the pnpm workspace root (and therefore `packages/db`/`packages/shared`)
   automatically from there.
2. Set environment variables (Project Settings → Environment Variables):
   - `DATABASE_URL` → Neon's **pooled** connection string.
   - `AUTH_SECRET` → `openssl rand -base64 33`.
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` → from a GitHub OAuth App
     (github.com/settings/developers) with callback URL
     `https://<your-vercel-domain>/api/auth/callback/github`.
   - `REALTIME_JWT_SECRET`, `INTERNAL_SYNC_SECRET` → **exactly** what you set on Render in step 2.
   - `NEXT_PUBLIC_SYNC_SERVER_URL` → `wss://<your-render-service>.onrender.com`.
   - `SYNC_SERVER_INTERNAL_URL` → `https://<your-render-service>.onrender.com`.
   - `GEMINI_API_KEY` → from aistudio.google.com/apikey.
   - `GMAIL_USER` / `GMAIL_APP_PASSWORD` → same Gmail account + app password as local dev.
3. Deploy. Vercel redeploys automatically on every push to the connected branch.

### CI

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, and both builds on every PR/push —
it doesn't deploy anything. Render and Vercel both redeploy on push via their own native GitHub
integration once connected, so no custom deploy workflow is needed for either.

## Known limitations

- **Invite emails go out via Gmail's SMTP relay (Nodemailer), not a transactional-email API.**
  This is deliberate — it needs no domain purchase or verification and can email any recipient
  immediately, at the cost of personal Gmail's send limits (~500/day) and showing as sent "via
  gmail.com" in some mail clients. Email delivery failures never block the invite itself
  (`apps/web/lib/email.ts` logs and continues) — the access grant / pending-invite row is the part
  that actually matters, and it always succeeds independently of whether the notification email
  does. Without `GMAIL_USER`/`GMAIL_APP_PASSWORD` set, invites still work exactly the same way,
  just silently skipping the email.

## Before submitting

Fill in your real name, GitHub, and LinkedIn URLs in
[`components/layout/footer.tsx`](apps/web/components/layout/footer.tsx) — currently placeholders.
