# SkillForge AI — Production deployment (Railway)

Status legend used throughout: **Implemented** (code exists and is tested locally) ·
**Configured** (set up in a real account) · **Tested** (verified against the real service) ·
**Pending** (needs your account, credentials or approval) · **Recommended** (advice only).

> Nothing in this document has been deployed yet. Every Railway, Resend, Anthropic and DNS
> step below is **Pending** until you perform it (or approve it).

## 1. Architecture (initial launch)

```
Browser ──https──► Railway edge (TLS, HTTP→HTTPS 301, sets X-Real-IP / X-Forwarded-Proto)
                      │
                      ▼
              app service (1 instance, Node 24, `next start`)
               │   ├─ volume mounted at /data  → CV files in /data/uploads
               │   ├─ Anthropic API (AI features)
               │   └─ Resend API (password-reset email)
               ▼
              Postgres service (Railway, private network, scheduled volume backups)
```

Why one long-running instance (not serverless): rate limits and duplicate-request locks are
**in memory** (correct only within one process), AI jobs run in the background after the
response and can take minutes, and CVs live on a local volume. Railway volumes also **prevent
replicas**, which enforces the single instance. Scaling out requires the steps in §11 first.

## 2. Prerequisites — Pending

1. **Git** installed locally, the project committed, and pushed to a **private** GitHub repository.
   `.gitignore` excludes `.env*` (except the two templates), `.data/` (local CVs), build output
   and test artifacts.
2. A Railway account. **Hobby plan or higher**: the server used 380–490 MB of memory under the
   E2E load, which exceeds the Free plan's 0.5 GB per service.
3. An Anthropic API key (Console → API keys). Set a monthly **spend limit** in the Console.
4. A Resend account, and — to email anyone other than yourself — **a domain you own** verified
   in Resend (DNS records). Without a verified domain Resend only delivers to your own account
   address, so password reset can't serve real users.

## 3. Create the Railway project — Pending

1. New project → **Deploy PostgreSQL** (service name `Postgres`). Keep it private (no public
   networking) unless you temporarily need it.
2. **Add a service from your GitHub repo** (the app). Railway reads `railway.json`:
   Railpack build (`npm run build`), start (`npm run start`), health check
   `/api/health/ready` (database reachable) and restart on failure. No pre-deploy command:
   **migrations never run automatically** (see §6).
3. App service → **Volumes** → attach a volume mounted at **`/data`**.
4. App service → Settings → Networking → **Generate Domain** (gives
   `https://<name>.up.railway.app`). Use it as the app URL until you have a custom domain.

## 4. Variables — Pending

Copy every variable from [`.env.production.example`](.env.production.example) into the app
service's Variables, replacing each `<placeholder>`:

| Variable                                        | Value                                                 | Notes                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`, `AUTH_URL`               | `https://<name>.up.railway.app`                       | Same origin; **build-time** (reset links, canonical URLs, HSTS). Redeploy after changing. |
| `AUTH_TRUST_HOST`                               | `true`                                                | TLS ends at Railway's edge.                                                               |
| `AUTH_SECRET`                                   | output of `npx auth secret`                           | New value for production only.                                                            |
| `CLIENT_IP_HEADER`                              | `x-real-ip`                                           | Railway's edge sets `X-Real-IP` to the client address.                                    |
| `DATABASE_URL`                                  | `${{Postgres.DATABASE_URL}}`                          | Reference variable (private network).                                                     |
| `DATABASE_POOL_MAX`                             | `10`                                                  | One instance × 10 ≪ PostgreSQL's 100 connections.                                         |
| `AI_PROVIDER`, `AI_API_KEY`                     | `anthropic`, your key                                 | Keep `AI_MODEL` empty for the default (`claude-opus-5-5`).                                |
| `MAIL_TRANSPORT`, `RESEND_API_KEY`, `MAIL_FROM` | `resend`, key, `SkillForge AI <no-reply@your-domain>` | `MAIL_FROM` domain must be verified in Resend.                                            |
| `STORAGE_LOCAL_DIR`                             | `/data/uploads`                                       | Absolute path on the volume (required for a public deployment).                           |

The server **refuses to start** in production when a value is unsafe or missing (placeholder
secret, http URL, mismatched origins, relative storage path, Resend without key/sender,
Anthropic without key). Errors name the variable and rule, never the value.

## 5. Database — Pending

- **Dedicated database**: the Railway `Postgres` service is used only by production. Never point
  it at, or copy it from, the development (`skillforge`) or E2E (`skillforge_e2e`) databases.
- **TLS**: the app connects over Railway's private network. If you ever connect over the public
  TCP proxy, add `sslmode=require` to that URL.
- **Least privilege (Recommended)**: Railway's default role is a superuser. After the first
  migration, create a runtime role and point `DATABASE_URL` at it, keeping the owner role for
  migrations only:
  ```sql
  CREATE ROLE skillforge_app LOGIN PASSWORD '<strong-random-password>';
  GRANT CONNECT ON DATABASE "<database name from PGDATABASE>" TO skillforge_app;
  GRANT USAGE ON SCHEMA public TO skillforge_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO skillforge_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO skillforge_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO skillforge_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO skillforge_app;
  ```
  (Run the migrations with the owner role: `DATABASE_URL=<owner url> npm run db:migrate:deploy`.)
- **Backups**: Postgres service → Backups → enable **Daily** (kept 6 days) and **Weekly**
  (kept 27 days); also enable them for the app volume (CV files). Take a **manual backup before
  every migration**. Test a restore once before launch (see OPERATIONS.md).

## 6. Migrations (every release that adds one) — requires approval

Migrations are additive and applied with `prisma migrate deploy`. **Never** use
`prisma migrate reset`, `db push` or any destructive command against production.

1. Take a manual Postgres backup in Railway.
2. Open a shell in the app container: `railway ssh` (or copy the SSH command from the dashboard).
3. `npm run preflight` — read-only. It validates the environment, prints the target database
   (host, database, user; no password), refuses development/E2E databases and local hosts,
   reports TLS and the role, and lists pending migrations (flagging destructive SQL).
4. Review each pending `prisma/migrations/<name>/migration.sql`.
5. With approval: `npm run db:migrate:deploy`, then `npm run db:status` (expect "up to date").

Order of operations: migrations must be backward compatible with the running release
(additive only), so apply them **before** deploying the code that needs them.

## 7. First deployment — requires approval

1. Variables set (§4), volume attached (§3), backups enabled (§5).
2. Trigger the deploy. Railway builds, starts the server and only routes traffic once
   `/api/health/ready` returns 200 (database reachable).
3. Apply the migrations (§6) — the first time this creates all tables.
4. Run the smoke test from your machine:
   `npm run smoke -- https://<name>.up.railway.app` (GET requests only; no data created).
5. Manual checks with a test account you control (never real user data):
   register → log out → log in → upload the sample CV from `tests/fixtures/cv/sample-cv.pdf`
   → CV analysis → Job Match → roadmap → interview (one answer) → assessment → portfolio and a
   public page → password reset to your own inbox → delete the test data.

Note: redeploying a service with a volume causes a short downtime (Railway documents this).

## 8. AI provider (Anthropic) — Implemented, real-provider tests Pending

- Implemented: provider abstraction, structured outputs validated with Zod, grounding,
  prompt-injection fencing, 150k-character prompt cap, per-request timeout (`AI_TIMEOUT_MS`),
  one SDK retry, refusal and truncation handling, per-user hourly limits.
- Not yet tested against the real API (no key was available during preparation). After setting
  the key, run the manual flow in §7 with the sample CV only.
- Cost (verified on the Anthropic pricing page): Claude Opus 5.5 is **$4 / million input
  tokens and $20 / million output tokens**. A CV analysis sends roughly a few thousand input
  tokens and receives a few thousand output tokens (including reasoning), so expect on the order
  of **$0.05–$0.20 per AI action**; roadmap generation (up to 16k output tokens) can reach about
  **$0.35**. Per-user hourly limits cap abuse; set an organization **spend limit** in the
  Anthropic Console. To reduce cost, set `AI_MODEL` to a cheaper model after testing output
  quality (e.g. Sonnet 5.5 at $2 / $10 per million).

## 9. Email (Resend) — Implemented, delivery Pending

- Implemented: `MAIL_TRANSPORT=resend` sends through Resend's HTTPS API (no SDK), with a 10 s
  timeout, text + escaped HTML, and logs that contain only the HTTP status on failure — never
  the recipient, link or token. The reset request is processed **after** the response, so the
  response (same message for known and unknown emails) doesn't reveal whether an account exists
  through its timing either. Limits: 5 requests / 15 min per IP, 3 emails / hour per address.
- Pending: a domain verified in Resend (§2), then a delivery test to an inbox you control.
  Password reset is **not** production-ready until that test succeeds.

## 10. Domain and HTTPS

- Today: Railway's `*.up.railway.app` domain with Railway-managed Let's Encrypt certificates
  and HTTP→HTTPS redirect (documented by Railway).
- Custom domain (Pending, needs a purchase): add it in Railway (Settings → Networking), create
  the DNS record Railway shows, wait for the certificate, then update `NEXT_PUBLIC_APP_URL` and
  `AUTH_URL` and **redeploy** (build-time values). The same domain can be verified in Resend for
  email.
- HSTS (`max-age` two years, `includeSubDomains`) is sent automatically when the app URL is
  https. Add `preload` only after deciding to submit the domain to the preload list.

## 11. Before scaling beyond one instance — Recommended

1. Move CV files from the volume to object storage (implement the `FileStorage` interface in
   `lib/storage/`; the app already depends only on that interface).
2. Install a shared rate-limit store (`setRateLimitStore()` in `lib/security/rate-limit.ts`,
   e.g. Redis `INCR` + `PEXPIRE NX`) and replace `createKeyedLock` with a distributed lock.
3. Move background AI jobs to a queue so restarts don't interrupt them.
4. Only then add replicas.

## 12. CI/CD and release process

- **Implemented**: `.github/workflows/ci.yml` runs on every pull request and push to `main`:
  `npm ci`, Prisma validate, typecheck, lint, Prettier, unit tests, the runtime dependency
  audit (`npm run audit:prod`, with the reviewed allowlist in `audit-allowlist.json`), a
  production build, and the full E2E suite against a PostgreSQL 17 service container. It never
  deploys and holds no secrets.
- **Pending** (after the GitHub repo exists): protect `main` (require pull requests and the CI
  checks), and in Railway enable **Wait for CI** so a push to `main` deploys only after CI
  passes. Railway's Wait for CI waits for _all_ GitHub check suites on the commit.

Release checklist:

1. Merge a reviewed pull request into `main` (CI green).
2. If it contains migrations: §6 first.
3. Railway deploys after CI; watch the deploy logs until the health check passes.
4. `npm run smoke -- https://<app-url>`.
5. Watch logs for errors and `"type":"security"` events for 30 minutes.

Rollback: Railway → Deployments → previous successful deployment → **Redeploy**. Code
rollbacks are safe because migrations are additive; never roll back a migration by dropping
objects. If data was damaged, restore the database backup (OPERATIONS.md).
