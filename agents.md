# AGENTS.md — ReachInbox Email Scheduler

This file is the standing contract for any AI agent (Antigravity, Claude, Gemini,
Copilot, etc.) working in this repository. Read this in full before touching code.
If a later instruction conflicts with this file, this file wins unless the human
explicitly overrides it in chat.

---

## 1. What we're building

A **production-grade email scheduler service + dashboard** (ReachInbox take-home
assignment). Not a toy CRUD app — the grading rubric specifically rewards:
persistence across restarts, correct queue semantics, real rate-limiting,
idempotency, and a working Slack + Google OAuth integration. Cutting corners on
those five things costs more than a rough UI.

## 2. Hard constraints (never violate these)

- **No cron.** Not `node-cron`, not `agenda`, not OS crontab, not `setInterval`
  pretending to be a scheduler. Scheduling = **BullMQ delayed jobs** (or a
  custom Redis/DB-driven scheduler) only.
- **No mock auth.** Google OAuth must be a real OAuth2 flow (Authorization Code
  grant). Slack must be a real OAuth "Connect Slack" flow that stores a
  token/webhook per user/tenant — not a hardcoded webhook URL in `.env`.
- **No in-memory-only state.** Rate-limit counters, job status, sender config,
  and OAuth tokens all live in Redis and/or the relational DB. If the process
  restarts, nothing may be lost or double-sent.
- **Idempotency is mandatory.** Every job must be keyed so that if BullMQ
  retries it, or the worker crashes mid-send and restarts, the email is not
  sent twice. Use a unique job ID and a DB-level "sent" guard (e.g.
  `UPDATE ... SET status='sent' WHERE status IN ('pending','processing')`,
  check rows affected).
- **Rate limiting must be cross-worker safe.** Use Redis-backed counters keyed
  by `sender + hour_window` (e.g. `INCR` + `EXPIRE`, or a sorted set/token
  bucket). Never rely on a JS variable in worker memory.
- **When an hourly cap is hit, jobs are rescheduled into the next window, not
  dropped or failed.** Preserve send order within a sender as much as
  possible (FIFO per sender).

## 3. Tech stack (do not substitute without asking)

| Layer      | Choice                                                              |
|------------|----------------------------------------------------------------------|
| Backend    | TypeScript, Express.js                                              |
| Queue      | BullMQ + Redis                                                      |
| DB         | PostgreSQL (preferred) or MySQL, via Prisma or Drizzle (pick one, be consistent) |
| Search     | Elasticsearch (index scheduled + sent emails; expose a search endpoint) |
| SMTP       | Ethereal Email (fake SMTP, per-sender credentials)                  |
| Auth       | Google OAuth 2.0 (Authorization Code flow), session via JWT or signed cookie |
| Slack      | Slack OAuth2 (`chat.write` or Incoming Webhook via OAuth), stored per tenant |
| Frontend   | React or Next.js + TypeScript + Tailwind CSS                        |
| Infra      | Docker Compose for Redis + Postgres + Elasticsearch (recommended)   |
| Queue UI   | Bull Board (or Bull-Monitor) mounted at `/admin/queues`              |

Do not add a second ORM, a second queue library, or a second CSS framework
mid-project. If you think the stack needs to change, stop and flag it instead
of silently switching.

## 4. Repository structure

Use a monorepo with clear boundaries:

```
/backend
  /src
    /config          # env loading, redis client, db client, es client
    /db               # schema/migrations (prisma/drizzle)
    /queues
      /producers       # enqueue logic (schedule.producer.ts)
      /workers         # BullMQ worker(s) (email.worker.ts)
      /limiter         # rate-limit + window logic (redis-backed)
    /routes           # express routers (auth, emails, senders, slack)
    /controllers
    /services         # business logic, kept separate from controllers
    /integrations
      /google-oauth
      /slack
      /ethereal
      /elasticsearch
    /middleware       # auth guard, error handler, validation
    /types
    server.ts
    worker.ts          # separate entrypoint so worker can scale independently
  docker-compose.yml
  .env.example
  README.md

/frontend
  /src
    /app or /pages
    /components        # Button, Input, Table, Modal, EmptyState, Toast...
    /features
      /auth
      /compose
      /scheduled
      /sent
      /slack-connect
    /lib               # api client, types
    /hooks
  .env.example

AGENTS.md
INSTRUCTIONS.md
README.md
```

Do not dump backend logic into route handlers. Controllers stay thin; services
hold logic; workers only orchestrate.

## 5. Coding conventions

- **TypeScript strict mode on**, in both frontend and backend. No `any` unless
  justified with a comment.
- Every API response and request body gets a typed interface/DTO. Validate
  incoming payloads (zod or similar) before touching the DB or queue.
- Environment variables are the only source of configurable limits — no
  hardcoded `MAX_EMAILS_PER_HOUR`, delay values, or concurrency numbers.
  Document every var in `.env.example` with a comment.
- Errors surface as structured JSON (`{ error: { code, message } }`), never a
  raw stack trace to the client. Log the real error server-side.
- Commit in small, logically scoped chunks (one feature/fix per commit) with
  descriptive messages — the grader reads the git history.
- Prefer explicit, boring code over clever abstractions. This is graded on
  correctness and clarity, not novelty.

## 6. Definition of done (per feature)

A feature is not done until:
1. It works end-to-end (frontend → API → queue/DB → worker → visible result).
2. It survives a backend restart without data loss or duplicate sends.
3. It has a loading state, an empty state, and an error state on the frontend
   (where applicable).
4. The README's "features implemented" table is updated.

## 7. What NOT to do

- Don't fabricate a Figma design — if no Figma link is actually usable, build
  a clean, modern dashboard by your own judgment and note this as an
  assumption in the README (see `INSTRUCTIONS.md` §0).
- Don't invent Slack/Google OAuth client IDs or secrets. Leave clear
  placeholders in `.env.example` and stop to ask the human for real
  credentials before wiring the flow end-to-end.
- Don't silently skip Elasticsearch because it's the most "optional-feeling"
  requirement — it's explicitly graded. If ES setup is genuinely blocked,
  say so and propose a fallback (e.g. Postgres full-text search) rather than
  quietly dropping it.
- Don't send real emails anywhere except Ethereal's sandbox SMTP.