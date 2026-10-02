# SkillForge AI — Security

This document describes the security controls **implemented** in the code, how
to configure them for production, and what is **not** implemented yet. Anything
under "Recommended" is advice, not an existing feature.

## Architecture at a glance

| Layer             | Control (implemented)                                                                                                                                             | Where                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Routing           | `proxy.ts` redirects signed-out users away from `/dashboard/*` (optimistic, cookie only)                                                                          | `proxy.ts`                                                     |
| Authentication    | `requireUser()` re-validates every request against the database: user exists, password not changed since sign-in, session not revoked                             | `lib/auth/session.ts`                                          |
| Authorization     | Every private query is scoped by the session user's id; another user's record behaves exactly like a missing one                                                  | `lib/*/service.ts`, `lib/data/*`                               |
| Input             | Zod schemas at every server boundary (server actions, route handlers, route params)                                                                               | `lib/validations`, `lib/*/validation.ts`, `lib/*/schema.ts`    |
| Output            | React escaping only; no `dangerouslySetInnerHTML`, no user HTML; user links rendered only for absolute http(s) URLs with `rel="noopener noreferrer nofollow ugc"` | `components/public-portfolio/public-shell.tsx`                 |
| Abuse             | Named, store-backed rate limiters for every sensitive action; duplicate-request locks                                                                             | `lib/security/rate-limit.ts`, `lib/*/rate-limits.ts`           |
| Transport/browser | CSP, HSTS (https), frame denial, nosniff, COOP/CORP, Permissions-Policy, no-store on private responses                                                            | `next.config.ts`                                               |
| AI                | Untrusted content fenced and sanitized, Zod-validated output, grounding checks, prompt-size guard                                                                 | `lib/ai/untrusted.ts`, `lib/ai/guard.ts`, `lib/*/grounding.ts` |
| Configuration     | Environment validated at startup; unsafe production values stop the server                                                                                        | `lib/env-schema.ts`, `instrumentation.ts`                      |
| Logging           | Security events as JSON lines with pseudonymous fingerprints; no secrets or private content in logs                                                               | `lib/security/audit-log.ts`                                    |

## Authentication and sessions

- **Passwords**: scrypt hashes; the hash never leaves `lib/auth` (explicit `select`s). Login
  compares against a dummy hash for unknown and OAuth-only emails, so timing doesn't reveal
  which accounts exist. Login errors are always "Invalid email or password."
- **Sessions**: Auth.js JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` and the
  `__Secure-` prefix on https), 30-day lifetime. The JWT carries only the user id, the sign-in
  time and a random session id (`sid`).
- **Every request is re-validated** in the database (`getSessionState`): deleted users,
  sessions issued before a password change (`passwordChangedAt`) and **revoked sessions** are
  rejected and sent to `/auth/session-expired`, which clears the cookie.
- **Sign-out revokes the session server-side** (Phase 9): the `signOut` event records the
  session's `sid` in `RevokedSession` until the token would have expired, so a copied cookie
  stops working after logout. Expired rows are deleted on later sign-outs. Sessions issued before
  this change have no `sid` and simply expire on their own.
- **Password reset**: 32-byte random token, only its SHA-256 stored, 1-hour expiry, single
  use. Consuming the token and changing the password happen in one transaction, and only the
  request that actually deleted the token proceeds (no double use). The password change
  invalidates every existing session. The response never depends on whether the email exists — neither
  its text nor its timing: the account lookup, token and email (Resend) happen after the response
  is sent (Phase 10). Mail logs carry only the HTTP status, never the recipient, link or token.
- **Email change** requires the current password (password accounts), limited to 5 checks per
  15 minutes per user so a hijacked session can't be used to guess the password.
- **Open redirects**: `callbackUrl` accepts only same-origin relative paths (`safeRedirectPath`).
- **Google OAuth**: enabled only when both credentials are set (validated at startup). No
  automatic account linking by email.
- **CSRF**: Server Actions are protected by Next.js (Origin check). The only cookie-authenticated
  route handler that changes state (`POST /api/cv`) checks `Origin` against the host.

## Authorization (IDOR)

All private data access goes through functions that take the user id from `requireUser()` and
include it in the `where` clause (`{ id, userId }`, or through the parent for nested records such
as evidence → project → user, answers → interview → user). Ids from the browser are validated for
shape (`idSchema`) and then treated only as lookup keys. Unit tests per module (`*-ownership.test.ts`)
and E2E tests tamper with ids in requests to confirm another user's records are never read,
changed, regenerated or deleted. Public portfolio pages read through
`lib/data/public-portfolio.ts`, which selects only public fields of public items and never
returns internal ids.

## File uploads (CV)

Implemented:

- Size limit (default 10 MB) enforced from `Content-Length` before buffering and again on the bytes.
- Extension allow-list (`.pdf`, `.docx`); the browser MIME type must match or be generic; the
  decision is made from the **file signature**, not the name or MIME type.
- DOCX: macro documents rejected; ZIP entry count, declared size and ratio checked; **and every
  entry is actually inflated with a hard output cap** (`lib/cv/zip-guard.ts`), so a
  decompression bomb that forges small sizes in its headers is rejected at upload and again
  before parsing. Zip64, encrypted and unknown-method archives are rejected.
- Text extraction has a 20 s timeout and keeps at most 50,000 characters; only plain text is
  extracted (no HTML is produced or rendered); macros are never executed.
- Storage keys are generated on the server (`cv/<userId>/<uuid>`); the original filename is
  never used in a path. The local driver resolves keys inside a private root outside `public/`,
  refuses traversal, never overwrites (`wx`) and writes files with mode `0600`.
- Files are only read through ownership-checked server code; there is no download route.
  Deleting a CV deletes its stored file.

Not implemented (limitations):

- **No malware/antivirus scanning.**
- **No OCR**: scanned PDFs are reported as needing OCR.
- **No encryption at rest** by the application (rely on disk/volume encryption).
- PDF parsing (pdf.js via `unpdf`) runs in the server process; the timeout bounds waiting, not
  CPU or memory used by a hostile PDF. Recommended: move extraction to a worker thread or
  sandboxed process with memory limits.

## AI security

- **System vs. user content**: instructions live only in the `system` field. CVs, job
  descriptions, answers, questions, portfolio facts and evidence go into the prompt inside
  fenced blocks (`<cv>`, `<job>`, `<answer>`, …) that the system prompt marks as untrusted data.
- **Fence integrity** (Phase 9): `untrustedBlock()` neutralizes any tag-like sequence for our
  block names inside the content (`</cv>`, `< /CV >`, `<answer role="system">`, …) and strips
  control and bidi-override characters, so content can't close its block and pose as
  instructions. Titles and labels outside blocks are single-lined and sanitized.
- **Output**: every response is validated with Zod; invalid output fails safely with a generic
  message. Grounding checks drop invented skills, employers, numbers, quotes and claims;
  scores are computed in code, never by the model. AI output never decides ownership or access.
- **Limits**: input sizes are bounded where they enter; `withRequestGuards` rejects any prompt
  over 150,000 characters or 16,000 output tokens before a provider is called; per-user hourly
  limits on every AI feature; 1 SDK retry; per-request timeout.
- **Privacy**: providers never log prompts or outputs; errors carry no request content. Only
  what a feature needs is sent (e.g. portfolio AI gets portfolio facts, never CV text or contact
  details).

## Rate limiting and abuse protection

| Action                                                  | Limit (per window)                      | Key                       |
| ------------------------------------------------------- | --------------------------------------- | ------------------------- |
| Login                                                   | 10 / 15 min                             | account (email), any IP   |
| Login                                                   | 50 / 15 min                             | client IP, any account    |
| Register                                                | 10 / hour (configurable)                | client IP                 |
| Forgot password                                         | 5 / 15 min; email sent at most 3 / hour | client IP; email (silent) |
| Reset password                                          | 5 / 15 min                              | client IP                 |
| Email change password check                             | 5 / 15 min                              | user                      |
| CV upload / analysis                                    | 10 / 20 per hour                        | user                      |
| Job Match, roadmap, interview, assessment, portfolio AI | 10–20 per hour                          | user                      |
| Interview answers, assessment saves/submits             | 120 / 400 / 30 per hour                 | user                      |

- **Client IP** (Phase 9): taken from the `X-Forwarded-For` entry appended by the outermost
  trusted proxy (`TRUSTED_PROXY_HOPS`, default 1), never from the client-supplied part, so
  forging the header doesn't create fresh buckets. On Railway (Phase 10) set
  `CLIENT_IP_HEADER=x-real-ip`: Railway documents `X-Real-IP` as the client's address set by its
  edge, while its `X-Forwarded-For` handling is undocumented. Per-account limits don't depend on
  the IP. **Verify after the first deploy** that a forged `X-Real-IP` from a client doesn't reach
  the app (it should be overwritten by Railway's edge).
- **Store**: limiters are async and use a pluggable `RateLimitStore`. The default is
  **in-memory**: limits apply per server instance and reset on restart, and duplicate-request
  locks (`createKeyedLock`) are per process. **With more than one instance, attackers can multiply
  their budget by the number of instances.** Before scaling out, install a shared store with
  `setRateLimitStore()` (e.g. Redis: `INCR` + `PEXPIRE NX` in one `MULTI`) and replace the keyed
  locks with a distributed lock. No Redis dependency is required today.
- A per-account login limit can be used to lock a victim out for 15 minutes; this is the usual
  trade-off against password guessing.

## HTTP headers

Set on every response (`next.config.ts`):

- `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`;
  `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https:`; `connect-src 'self'`;
  `object-src 'none'`; `base-uri 'self'`; `form-action 'self' https://accounts.google.com`;
  `frame-ancestors 'none'`; `frame-src 'none'`; plus `upgrade-insecure-requests` on https.
  `'unsafe-inline'` scripts are needed because the App Router streams inline scripts; a
  nonce-based policy would make every page dynamic (recommended future work).
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` — **only when `AUTH_URL` or
  `NEXT_PUBLIC_APP_URL` is https** at build time. Add `preload` only after submitting the domain.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone,
  geolocation, payment, USB and motion sensors disabled), `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`, `Origin-Agent-Cluster: ?1`; no `X-Powered-By`.
- `Cache-Control`: dynamic pages are `private, no-cache, no-store` (Next.js); `/api/*` is
  `private, no-store`.

## Configuration and secrets

- `.env*` files are git-ignored except `.env.example`, which contains no secrets. Secrets are
  server-only; the only `NEXT_PUBLIC_` variable is the public app URL.
- The environment is validated when the server starts (`instrumentation.ts`). Errors list
  variable names and rules, never values. In **production** the server refuses to start when:
  `AUTH_SECRET` is short or a placeholder, `AUTH_URL`/`NEXT_PUBLIC_APP_URL` aren't https (except
  localhost), `MAIL_TRANSPORT=console`, `AI_PROVIDER=anthropic` without `AI_API_KEY`, or only one
  Google credential is set. Running with the mock AI in production logs a warning.

## Logging and monitoring

- Application logs carry ids and error codes only — never passwords, tokens, API keys, CV text,
  job descriptions, prompts, AI output or answers. Auth.js errors are logged by name/message only.
- Security events (`lib/security/audit-log.ts`), one JSON line each with `"type":"security"`:
  `rate_limit.exceeded` (once per window, limiter name + fingerprint), `auth.password_reset_completed`,
  `auth.reauth_failed`, `auth.session_revoked`, `request.cross_origin_rejected`. Emails and IPs
  appear only as non-reversible 16-character fingerprints.
- Production error pages never show stack traces (Next.js replaces server error messages with a
  digest).

**Recommended (not configured):** ship logs to a central store; alert on bursts of
`rate_limit.exceeded` (login-account / login-ip), on `request.cross_origin_rejected`, on 5xx rates
and on AI provider failures; add error tracking (e.g. Sentry) with PII scrubbing; uptime checks on
`/api/health`.

## Data protection

- PostgreSQL via Prisma with parameterized queries only (no raw SQL). Use TLS to the database in
  production (`sslmode=require` in `DATABASE_URL`) and a least-privilege role.
- Deleting a user cascades to all their data (CVs, analyses, matches, roadmaps, interviews,
  assessments, portfolio). Revoked-session rows hold no personal data.
- Migrations are additive and applied with `prisma migrate deploy`; never `migrate reset`.

## Production checklist

1. `AUTH_SECRET`: 32+ random characters (`npx auth secret`); different per environment.
2. `AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to the https origin **before building** (HSTS and
   `upgrade-insecure-requests` are decided at build time).
3. Serve only over https behind a proxy that appends to `X-Forwarded-For`; set
   `TRUSTED_PROXY_HOPS` to the number of such proxies.
4. `AI_PROVIDER=anthropic` with `AI_API_KEY` stored in the platform's secret manager.
5. `DATABASE_URL` with TLS and a least-privilege user; regular encrypted backups.
6. Storage directory on encrypted disk, outside the web root, not shared publicly.
7. One instance only, or a shared rate-limit store and distributed locks first.
8. Email: `MAIL_TRANSPORT=resend` with `RESEND_API_KEY` and a `MAIL_FROM` on a domain verified in
   Resend; test delivery to your own inbox before relying on password reset.
9. Log shipping, alerting and error tracking as above.
10. Run `npm audit` and keep dependencies updated.

## Known limitations and future improvements

- In-memory rate limits and locks (single instance) — shared store recommended.
- CSP allows inline scripts — nonce-based CSP recommended.
- No malware scanning, OCR or application-level encryption of stored CVs.
- PDF extraction runs in-process — worker/sandbox isolation recommended.
- No multi-factor authentication, no "sign out everywhere" button, no login notification emails.
- No email verification for new accounts or changed addresses (the address is marked unverified).
- Password reset needs a verified sending domain (Resend); until then it's unavailable in production.
- No self-service account deletion or data export yet.
- Sessions issued before Phase 9 can't be revoked individually (they expire within 30 days, and
  a password reset still invalidates them).
