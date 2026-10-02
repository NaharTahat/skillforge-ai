# SkillForge AI

> Turn your skills into your next opportunity.

AI-powered career intelligence platform: CV analysis, job matching, career roadmaps, interview practice, skill assessments and a public Skill Passport.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · Prisma 7 + PostgreSQL · Auth.js v5 · Zod · React Hook Form · Recharts · Lucide · Vitest · Playwright

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env.local  # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate          # apply migrations
npm run dev                 # http://localhost:3000
```

**Database.** Any PostgreSQL works. Without a local install, `npx prisma dev -n skillforge -d` starts
Prisma's local dev server; create a `skillforge` database on it and use its `postgres://` TCP URLs
for `DATABASE_URL` / `SHADOW_DATABASE_URL`. It is for development only — if queries start failing
with "Connection terminated unexpectedly", restart it with `npx prisma dev stop skillforge` and start
it again (data is kept). `DATABASE_POOL_MAX="1"` was the most stable setting with that server in testing.
Run the full E2E suite against real PostgreSQL instead (see [E2E database](#e2e-database-use-real-postgresql)).

**AI provider.** `AI_PROVIDER=mock` (default) runs a deterministic, rule-based stand-in with no
network calls; its reports are labelled "Mock analysis" and are not AI output. `AI_PROVIDER=anthropic`
with `AI_API_KEY` uses Claude (`claude-opus-5-5` by default, override with `AI_MODEL`) via structured
outputs, with server-side refusal fallback enabled. Keys are server-only. Mock mode only: a job title
containing `[mock:ai-failure]` makes assessment generation return invalid output, so the
provider-failure path can be tested end to end; it has no effect with a real provider.

**Real provider — manual verification.** Automated tests never call a real AI. To check the
Anthropic provider by hand: set `AI_PROVIDER="anthropic"` and `AI_API_KEY` in `.env.local` (never
commit it), restart the server, then (1) upload `tests/fixtures/cv/sample-cv.pdf` in the CV Analyzer
(2) run a Job Match against a real posting, (3) generate a roadmap from it, (4) complete a short
AI interview from it and (5) take a 5-question assessment from it. Reports should show no "Mock
analysis" banner, every
quoted CV line should exist in the CV, and missing requirements should quote the job description.

**CV storage.** Uploads are stored privately under `STORAGE_LOCAL_DIR` (default `.data/uploads`,
git-ignored, never under `public/`) with server-generated names. `lib/storage` is an interface, so an
S3/R2/Supabase driver can be added without touching the CV code.

**Auth.** `AUTH_SECRET` is required (`npx auth secret`). Google sign-in appears only when
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set (redirect URI: `<app-url>/api/auth/callback/google`).
No email provider is integrated yet: in development, password-reset links are printed to the server
log; in production, reset requests return "not available" until a provider is added.

## Features

**CV Analyzer** (`/dashboard/cv`) — upload a PDF/DOCX, extract text, and get a grounded, scored
report. Re-analysis keeps history.

**AI Job Match** (`/dashboard/job-match`) — pick an analyzed CV, paste a job description (100–20,000
characters) with optional title/company/location/URL, and get a profile-to-job match report:

- One AI pass extracts the job's requirements (required vs preferred, responsibilities, experience,
  education, technologies) and classifies each against the CV as found / partially shown / not found,
  with quotes from both texts.
- Code then grounds the result: requirements not quoted from the job are dropped, unverifiable CV
  evidence is downgraded, and a skill the CV mentions is never reported as simply "not found".
- The score is computed by `lib/job-match/scoring.ts` (required skills 30, preferred 15,
  experience 15, education 10, projects 10, technologies 10, keyword coverage 10), skipping
  dimensions the job doesn't specify. It measures alignment — it is not a hiring probability.
- Matches are private, saved in history, and can be reopened, re-run (a new record; the old one is
  kept; concurrent duplicates are collapsed) or deleted. The old `/dashboard/jobs` route redirects.

**Career Roadmap** (`/dashboard/roadmap`) — turn skill gaps into an ordered, trackable plan:

- Two sources: **from a Job Match** (recommended; gaps trace back to the job description and the
  Job Match result) or **from your Career Goal** (the goal set in Profile plus an analyzed CV and an
  optional 4/8/12/24-week target; clearly labelled as a career-goal roadmap).
- One AI pass reviews skill gaps (Strong / Developing / Not demonstrated in your CV) and drafts
  phases, tasks, milestones and recommendations. Code then grounds it (`lib/roadmap/grounding.ts`):
  strengths need a quote that exists in the CV, job gaps must be traceable to the job, and profile
  items not found in the CV are dropped. Unknown facts show "Not specified".
- Priorities (`lib/roadmap/prioritization.ts`) and time estimates (`lib/roadmap/time.ts`) are
  deterministic; the AI never sets priority. Prerequisites can only point to earlier tasks.
- Tasks are stored as rows (`RoadmapItem`). Status changes (Available → In progress → Completed,
  Reopen) need no AI call, are ownership-checked, and unlock dependent tasks. Progress is
  completed ÷ total tasks (`lib/roadmap/progress.ts`).
- History: open, re-generate (creates a new roadmap linked to the old one, which is kept) and delete.
  Concurrent duplicate generations are collapsed into one.

**AI Interview** (`/dashboard/interview`) — practice a realistic interview built from your own data:

- Sources: **Job Match** (recommended; uses the job description, the match result's present /
  partial / missing requirements and likely interview topics) or **Career Goal Interview** (the goal
  from Profile, an analyzed CV and, when one exists, the matching roadmap's skill gaps; clearly
  labelled, never presented as job-specific). A roadmap is optional.
- Configuration: type (Technical, Behavioral, Mixed, HR / General; Mixed by default), difficulty
  (Entry / Intermediate / Advanced, defaulting from the experience level in your profile or CV
  analysis — Entry when neither states one), 5 / 10 / 15 questions (10 by default) and a focus
  (the Job Match recommends Missing skills when required skills are missing or partial).
- One AI pass writes the questions (`lib/ai/interview.ts`). Code then grounds every question
  (`lib/interview/grounding.ts`): each must have a source (CV, CV analysis, job description, Job
  Match, career goal, roadmap or general behavioral/HR) and a reason, CV/job questions must quote or
  name something that really exists, project questions must quote a project from the CV, and wording
  that claims the candidate lacks a skill is rejected. Untraceable questions are dropped and the AI is
  asked once more if too few remain. The introduction is written in code, not by the AI.
- Answers are evaluated one at a time with a strict schema: verdict (strong / partial / needs more
  evidence / contains inaccuracies) and 0–10 ratings for technical accuracy, relevance, completeness,
  clarity, communication and evidence. Scores, progress (answered or skipped ÷ questions) and the
  final report — overall score, category scores with enough evidence, strengths, improvement areas,
  questions to review, recommendations and next practice linked only to real roadmap tasks, Job Match
  gaps and CV skills — are computed in code (`lib/interview/scoring.ts`, `lib/interview/report.ts`).
- Up to two follow-up questions per question, only when the evaluator finds one useful.
- History: open, practice again (a new interview; the old report is kept) and delete. Concurrent
  duplicate starts collapse into one. Answers are private and never logged.

**AI Assessments** (`/dashboard/assessments`, `/dashboard/assessments/[id]`,
`/dashboard/assessments/[id]/results`, `/dashboard/assessments/history`) — test what you actually know:

- Sources: **Job Match** (recommended; the job's requirements mapped onto supported skills), **Career
  Goal** (the goal's core skills plus your roadmap's skill gaps), **Skill** (one skill) or **Mixed**
  (2–6 skills). Only skills in the supported catalog (`lib/assessment/skills.ts`) are ever tested.
- Configuration: type (Technical / Conceptual / Practical / Mixed), difficulty (Beginner / Intermediate
  / Advanced / Adaptive — Adaptive uses your CV and Job Match evidence per skill and never reaches
  Advanced from the CV alone), 5–20 questions, time limit (none / 15–60 minutes; the timer starts when
  you press Start) and focus.
- Code plans every question first (`lib/assessment/plan.ts`: skill, type, difficulty, source and
  reason). One AI pass writes content for those slots (`lib/ai/assessment.ts`); grounding
  (`lib/assessment/grounding.ts`) checks each question fills its slot exactly, has valid answer data
  (one correct option, a true/false key, or expected points), doesn't reference the user's projects or
  history, and isn't a duplicate. Invalid slots are requested once more. The CV text is never sent.
- Question types: multiple choice, true/false, short answer, scenario and technical. Code answers are
  read and evaluated as text — never executed.
- Answers are saved one by one and locked; objective answers are graded on the server. On submit,
  open answers are rated 0–10 (accuracy, relevance, completeness, clarity, technical depth) and every
  score is computed in code (`lib/assessment/scoring.ts`): 1 point per question, open answers
  weighted 35/20/20/15/10; levels ≥85 Strong · ≥70 Competent · ≥50 Developing · <50 Needs
  improvement. Answer keys never reach the browser before results.
- Results: overall %, category and skill breakdowns, strengths, improvement areas and review topics
  (grounded AI insights about tested skills, with no numbers; rule-based fallback), recommendations
  linked read-only to your roadmap tasks, Job Match alignment for job assessments (not a claim of job
  readiness), and your latest AI Interview as a separate measurement — never combined.
- Integrity: assessment expiry (server-side deadline with a short grace period), locked answers,
  one answer per question, idempotent submission, ownership checks on every id. History keeps every
  attempt; "Practice again" creates a new assessment. The dashboard shows real assessment results.

**Portfolio** (`/dashboard/portfolio`, `/edit`, `/projects`, `/projects/new`, `/projects/[id]`,
`/skills`, `/settings`) — show what you've built:

- Overview with real counts (projects, public projects, skills, certifications, completed
  assessments) and a deterministic completion checklist (`lib/portfolio/completion.ts`: 10 equal
  steps, each linking to where it's done).
- Profile headline, bio, location and links; experience, education, certifications (always labelled
  user-provided — SkillForge doesn't verify them) and achievements, each with add / edit / delete.
- Projects: title, short and detailed description, role, technologies, linked skills, repository /
  live / image URLs, dates, status, featured flag and evidence links (repository, demo, docs,
  certificate, screenshot, publication; up to 10, shown as user-provided).
- **Everything is private by default.** Each item has its own visibility; the public page also needs
  a username and the "Make my portfolio public" switch, plus per-section switches.
- AI assistance (headline, bio, project description, skill summary) only rephrases the user's own
  portfolio facts — never the CV text or contact details. Output is Zod-validated, then grounded
  (`lib/portfolio/grounding.ts`): invented numbers, technologies, employment, clients, users,
  revenue, awards or expertise claims are dropped, and the request fails safely if nothing grounded
  remains. Headlines are assembled in code from the user's own role options and skills. Suggestions
  are placed in the form for review; nothing is saved until the user saves.

**Skill Passport** (`/dashboard/skill-passport`, `/dashboard/skill-passport/[id]`) — each skill with
its evidence. The level is self-assessed by the user and never set by AI. Evidence strength is
computed in code (`lib/portfolio/evidence.ts`): latest assessment (90–100 Strong evidence, 75–89 Good
evidence, 60–74 Developing, <60 Needs improvement), linked projects and certifications, AI Interview
answers, a CV-analysis quote, Job Match results and completed roadmap tasks. The per-skill page
(`[id]` is the user's skill entry) lists every source with a link. `/dashboard/passport` redirects
here.

**Public portfolio** (`/p/[username]`, `/p/[username]/projects/[slug]`, `/p/[username]/skills`) —
shows only PUBLIC items in enabled sections. It never includes email, phone, CV contents, assessment
or interview answers, roadmap or job-match details, auth data or database ids (projects use slugs).
Public skill evidence uses only public projects and certifications, plus assessment / interview
evidence if the owner allows it. Private or missing pages return the same 404. User links render only
for absolute http(s) URLs with `rel="noopener noreferrer nofollow ugc"`; no user HTML is ever
injected. SEO: title, description, Open Graph and canonical URL with no private data. Settings
offer Copy public link, Share Skill Passport and a QR code (rendered as SVG in React) that contains
only the public URL.

Data model: `Job` (the posting) and `JobAnalysis` (one run each); `Roadmap` references the CV, CV
analysis, job and job analysis it was built from (no copies of CV text or job descriptions) and owns
its `RoadmapItem` tasks. `Interview` references its sources the same way and owns its
`InterviewQuestion` rows (follow-ups link to their parent) and their `InterviewAnswer`. `Assessment`
references its sources, owns its `AssessmentQuestion` rows (each with one locked `AssessmentAnswer`)
and one `AssessmentResult` (migration `20261001170000_ai_assessments`). The portfolio reuses
`Profile` (headline, bio, links) and `User.username`, extends `Project` (slug, visibility, status,
dates, `ProjectEvidence`), `UserSkill` (visibility, summary) and `SkillPassport` (section switches),
and adds `Education`, `Certification`, `Achievement` and `Experience` (migration
`20261002010000_portfolio_skill_passport`, additive only). `RevokedSession` records signed-out session ids
(migration `20261003010000_session_revocation`, additive only). Migrations are in
`prisma/migrations`; apply them with `npm run db:migrate` (development) or `npx prisma migrate deploy`
(production). Never use `prisma migrate reset` on a database with real data.

## Scripts

| Script                      | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `npm run dev`               | Dev server                                                          |
| `npm run build`             | Production build                                                    |
| `npm run typecheck`         | `tsc --noEmit`                                                      |
| `npm run lint`              | ESLint                                                              |
| `npm run prettier:check`    | Prettier (check)                                                    |
| `npm run format`            | Prettier (write)                                                    |
| `npm test`                  | Unit tests (Vitest)                                                 |
| `npm run test:e2e`          | End-to-end tests (Playwright; needs DB + build)                     |
| `npm run test:e2e:pg`       | E2E against the dedicated PostgreSQL test DB                        |
| `npm run db:migrate`        | Create/apply migrations                                             |
| `npm run db:migrate:e2e`    | Apply migrations to the PostgreSQL test DB                          |
| `npm run db:validate`       | Validate Prisma schema                                              |
| `npm run db:migrate:deploy` | Apply migrations (production; after preflight and approval)         |
| `npm run db:status`         | Migration status                                                    |
| `npm run preflight`         | Read-only production preflight (env, target DB, pending migrations) |
| `npm run audit:prod`        | Runtime dependency audit with reviewed allowlist                    |
| `npm run smoke -- <url>`    | Non-destructive post-deploy smoke test                              |
| `npm run db:generate`       | Regenerate Prisma client                                            |

E2E tests run against `npm run start` on port 3100 using the locally installed Microsoft Edge
(`E2E_BROWSER_CHANNEL=chrome` to use Chrome instead) and `AI_PROVIDER=mock`. Playwright raises the
sign-up rate limit for its server because every test registers from the same IP.

### E2E database: use real PostgreSQL

Run the full E2E suite against a real PostgreSQL server, not the `prisma dev` (PGlite) server. Under
sustained E2E load on Windows, the `prisma dev` process aborted natively (`0xC0000409`) after a few
minutes, so the suite could not complete reliably. A real PostgreSQL server runs it consistently.

1. Run PostgreSQL 15+ locally (native install, Docker, or the official server binaries). Keep it on
   `localhost` and use a database dedicated to E2E tests — never a production database.
2. Create a role and database, e.g. as a superuser:
   ```sql
   CREATE ROLE skillforge LOGIN PASSWORD '<local-only password>';
   CREATE DATABASE skillforge_e2e OWNER skillforge ENCODING 'UTF8';
   ```
3. Create `.env.e2e.local` (git-ignored by the `.env*` rule) with the test connection:
   ```env
   DATABASE_URL="postgresql://skillforge:<password>@localhost:<port>/skillforge_e2e?schema=public"
   DATABASE_POOL_MAX="10"
   ```
   Variables from this file take precedence over `.env.local` for these commands only (Next.js and
   `prisma.config.ts` never override variables that are already set).
4. Apply migrations: `npm run db:migrate:e2e` (`prisma migrate deploy`; never `migrate reset`).
5. Build and run: `npm run build`, then `npm run test:e2e:pg`. Make sure nothing else is listening on
   port 3100, because Playwright reuses an existing server there.

The suite only adds data (each test registers its own users), so the database can be reused across
runs, or dropped and recreated at any time.

## Deployment

Production runs on **Railway** (one Node instance + Railway PostgreSQL + a volume for CVs),
with Anthropic for AI and Resend for email. See:

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — architecture, variables, database, migrations, first
  deploy, CI/CD, release and rollback.
- **[OPERATIONS.md](OPERATIONS.md)** — health checks, monitoring, backups and restore, incident
  response, secret rotation, dependency updates.
- **[.env.production.example](.env.production.example)** — production variables (placeholders only).

CI (`.github/workflows/ci.yml`) runs static checks, unit tests, the dependency audit, a build and
the E2E suite on PostgreSQL; it never deploys.

## Scaling notes

- Rate limits (sign-in, sign-up, CV upload, CV analysis, Job Match at 20 runs/user/hour, roadmap
  generation at 10/user/hour — task status updates are not counted, interview generation at
  10/user/hour and answer submissions at 120/user/hour, assessment generation at 10/user/hour,
  assessment answer saves at 400/user/hour and submissions (scoring + AI evaluation) at
  30/user/hour, AI portfolio assistance at 10/user/hour, login per account and per IP) run on a
  pluggable `RateLimitStore` (`lib/security/rate-limit.ts`). The default store, and the
  duplicate-request locks (including the 10-second AI portfolio duplicate window), are in-memory
  per server instance. They are not distributed: before running more than one instance, install a
  shared store with `setRateLimitStore()` (e.g. Redis) and a distributed lock.
- CV analysis, Job Match, roadmap and interview generation run in `after()` once the request's
  response is sent; interview answers are evaluated during the request. On serverless platforms, the
  route's `maxDuration` bounds it; analyses lost to a crash or restart are marked failed
  automatically and can be re-run. A job queue is the next step for heavy load.

## Structure

```
app/
  (marketing)/        landing page
  (auth)/             login, register, password reset, auth error pages
  dashboard/          app shell, feature sections, profile, portfolio, skill passport
  p/[username]/       public portfolio, project and Skill Passport pages
  api/                route handlers (auth, me, cv upload, health)
components/
  ui/                 shadcn/ui primitives
  auth/ forms/        auth forms and shared form primitives
  layout/ marketing/  site chrome and landing sections
  dashboard/ profile/ app shell, overview widgets, profile
  shared/             empty/error states, page header, avatar, readiness ring
lib/
  auth/               Auth.js config, session helpers, password hashing, actions
  data/               data access for the signed-in user (session-scoped)
  ai/                 AIProvider interface, provider factory, Anthropic + mock providers,
                      CV analyzer, job matcher, roadmap generator, interview generator/evaluator,
                      assessment generator/evaluator/analysis
  cv/                 file validation, text extraction, scoring, grounding, analysis pipeline
  job-match/          input validation, schema, scoring, grounding, pipeline, rate limit
  roadmap/            schema, grounding, prioritization, time, task status, progress, pipeline
  interview/          schema, grounding, scoring, state machine, progress, report, pipeline, rate limits
  assessment/         skill catalog, plan, schema, grounding, scoring, insights, state, pipeline, rate limits
  portfolio/          validation, slugs, completion, evidence strength, grounding, service, rate limits
  storage/            private file storage interface + local driver
  validations/        Zod schemas shared by client and server
  db/ config/ services/ security/ mail/ profile/
proxy.ts              optimistic route protection
prisma/               schema + migrations
tests/                unit (Vitest) and e2e (Playwright)
```

## Security model

See **[SECURITY.md](SECURITY.md)** for the full security architecture, configuration, production
checklist and known limitations. In short:

- Passwords are hashed with scrypt; hashes never leave the server.
- `proxy.ts` redirects signed-out users away from `/dashboard/*`; `requireUser()` in layouts,
  pages and server actions is the authoritative check and re-validates the user in the database.
- All user-owned data is queried with the id from `requireUser()` — never an id sent by the browser.
- Public portfolio pages (`/p/*`) read through `lib/data/public-portfolio.ts`, which selects only
  public fields of public items; another user's item behaves exactly like a missing one.
- Sessions are re-validated on every request and revoked server-side on sign-out
  (`RevokedSession`); a password reset invalidates all existing sessions.
- Rate limits use a pluggable store with per-account and per-IP login limits; the client IP is
  taken from the trusted proxy's `X-Forwarded-For` entry (`TRUSTED_PROXY_HOPS`).
- Untrusted text sent to the AI is fenced and sanitized against prompt injection; outputs are
  Zod-validated and grounded; prompts are size-capped.
- DOCX uploads are checked for decompression bombs by actually inflating them with a hard cap.
- CSP, HSTS (on https), frame denial, COOP/CORP and no-store on private responses.
- The environment is validated at startup; unsafe production settings stop the server.

## Roadmap

- **Phase 1** ✅ Setup, architecture, theme, landing page, dashboard shell, schema
- **Phase 2** ✅ Authentication, profile, protected routes
- **Phase 3** ✅ CV Analyzer (upload, extraction, provider-agnostic AI analysis, history)
- **Phase 4** ✅ AI Job Match (grounded requirement comparison, transparent scoring, history)
- **Phase 5** ✅ AI Career Roadmap (grounded skill gaps, deterministic priorities, task progress)
- **Phase 6** ✅ AI Interview (grounded questions, structured evaluation, code-computed scores, follow-ups)
- **Phase 7** ✅ AI Assessments (planned questions, server-side grading, code-computed scores, roadmap links)
- **Phase 8** ✅ Portfolio + Skill Passport (private-by-default portfolio, evidence-based skills, public page)
- **Phase 9** ✅ Security hardening (session revocation, abuse limits, prompt-injection fencing, upload bomb guard, headers, config validation)
- **Phase 10** 🚧 Production deployment — prepared and verified locally (Railway config, env
  validation, readiness check, Resend email, preflight/smoke/audit scripts, CI, runbooks);
  **not deployed yet** (needs Git, accounts, a domain and approval — see DEPLOYMENT.md)
