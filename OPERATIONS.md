# SkillForge AI — Operations runbook

For whoever runs production. Status labels: **Implemented** · **Configured** · **Tested** ·
**Pending** · **Recommended**. No monitoring, alerting or backup service is active until the
"Pending" steps are done — this document doesn't claim otherwise.

## Health checks — Implemented

| Endpoint                | Meaning                                                 | Use                                          |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `GET /api/health`       | The process is up (no dependencies).                    | Uptime monitor, liveness.                    |
| `GET /api/health/ready` | The database answers within 3 s. Returns 503 otherwise. | Railway deploy health check, uptime monitor. |

Both return only `{"status": …}` with `Cache-Control: no-store` — no versions, hosts or errors.
Railway uses the health check **only during deploys**, not continuously, so an external uptime
monitor is still needed.

## Monitoring and alerting — Pending / Recommended

- **Uptime** (Recommended): an external monitor (e.g. UptimeRobot, Better Stack) polling
  `/api/health/ready` every 1–5 minutes, alerting by email/SMS after 2 failures.
- **Logs** (Implemented format; shipping Pending): one line per event on stdout/stderr, visible
  in Railway's log view. Security events are JSON lines with `"type":"security"`:
  `rate_limit.exceeded`, `auth.password_reset_completed`, `auth.reauth_failed`,
  `auth.session_revoked`, `request.cross_origin_rejected`. Logs contain ids, error codes and
  pseudonymous fingerprints only — never passwords, tokens, keys, CV text or answers.
- **Alerts to configure** (Recommended): bursts of `rate_limit.exceeded` with
  `limiter: login-account` or `login-ip` (credential attacks); repeated
  `request.cross_origin_rejected`; `[health] readiness check failed`; repeated
  `[cv] analysis … failed: AI_*` (provider outage or key problem); `[mail] resend: send failed`.
- **Error tracking** (Recommended): Sentry or similar with PII scrubbing; not installed.
- **Costs**: Railway usage page; Anthropic Console usage and spend limit; Resend dashboard.

## Backups and restore — Pending

- Enable in Railway for **both** volumes (Postgres and the app's `/data` volume):
  Daily (kept 6 days) + Weekly (kept 27 days); Monthly (kept 89 days) if you need longer.
  Railway backups are incremental and billed by size.
- **Manual backup before every migration** and before risky changes.
- **Restore** (Railway documents this flow): service → Backups → choose the timestamp →
  Restore. Railway mounts a new volume from the backup and keeps the old one unmounted; review
  the staged change and Deploy.
- **Restore drill** (do once before launch, then quarterly): restore the latest Postgres backup
  into a _separate_ environment or service, point a non-production app at it, run
  `npm run smoke`, and record how long it took (your recovery-time estimate).
- Retention of user data: CVs, analyses and portfolio items stay until the user deletes them
  individually. **There is no self-service account deletion yet**; deleting a user row in the
  database cascades to all their data (CV files on the volume must be removed separately, under
  `/data/uploads/cv/<userId>/`). Decide and publish a privacy policy before launch.

## Incident response

1. **Detect**: uptime alert, error spike, security events, user report.
2. **Assess**: Railway → Deployments (did a deploy just happen?) and Logs. Check
   `/api/health/ready`. Check the Anthropic/Resend status pages for provider outages.
3. **Mitigate**:
   - Bad release → redeploy the previous successful deployment (Railway → Deployments).
   - Database unreachable → check the Postgres service, its volume usage and its logs.
   - AI provider outage → features fail gracefully with a friendly message; nothing to do but
     wait (optionally set `AI_MODEL` to another model and redeploy).
   - Abuse → limits block it per account/IP; for sustained attacks add Railway/Cloudflare-level
     blocking.
   - Suspected secret leak → rotate immediately (below).
4. **Communicate** to affected users if their data or availability was affected.
5. **Postmortem**: what happened, impact, root cause, fixes; keep it blameless.

## Secret rotation

| Secret               | How                                                                                        | Effect                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `AUTH_SECRET`        | Generate a new value, set it, redeploy.                                                    | Every session becomes invalid (everyone signs in again). |
| `AI_API_KEY`         | Create a new key in the Anthropic Console, set it, redeploy, then revoke the old key.      | None for users.                                          |
| `RESEND_API_KEY`     | Same pattern in Resend.                                                                    | None.                                                    |
| Database password    | Create a new role password (or new role), update `DATABASE_URL`, redeploy, revoke the old. | Brief reconnect.                                         |
| `AUTH_GOOGLE_SECRET` | Rotate in Google Cloud Console, set, redeploy.                                             | None.                                                    |

Rotate at least yearly, and immediately when someone with access leaves or a leak is suspected.

## Deployment rollback

Railway → app service → Deployments → pick the last good deployment → **Redeploy**.
Because migrations are additive, the previous code runs against the newer schema. Never "undo"
a migration by dropping tables or columns; if data must be repaired, restore a backup.

## Dependency updates

- Monthly: `npm outdated`, update in a branch, open a pull request; CI must pass (including
  E2E and the dependency audit).
- `npm run audit:prod` fails on any new high/critical runtime advisory not in
  `audit-allowlist.json`, and when an allowlist entry's `reviewBy` date passes. Current entries
  (Prisma CLI's bundled `mysql2` and `deepmerge-ts`; not reachable at runtime; the only npm fix
  is a breaking downgrade) are due for review by 2026-12-31.
- Next.js and Prisma major upgrades: read their upgrade guides; run the full E2E suite twice.

## Public portfolio caching — current state and safe strategy

- Current (Implemented): public pages render per request (`connection()`), so turning a
  portfolio or item private takes effect immediately. Measured locally: ~40 ms server time.
- If load grows (Recommended): cache rendered public pages with a short revalidation window
  **plus** on-demand invalidation from the owner's save actions (they already call
  `revalidatePath` for `/p/[username]`). Never cache dashboard pages or API responses (they are
  `no-store`), and never put private data in a cached page.

## Known operational limitations

- Single instance (in-memory rate limits and locks; volume-backed storage) — see DEPLOYMENT.md §11.
- Short downtime on each redeploy (volume attached).
- Background AI jobs interrupted by a restart are marked failed and can be re-run by the user.
- No malware scanning, OCR, application-level encryption of CVs, or PDF parser sandboxing.
- Password reset depends on a verified email domain.
- No self-service account deletion or data export, and no privacy policy / terms pages yet.
