# INSTRUCTIONS.md — Build Plan for Antigravity

How to use this file: paste it into Antigravity as your task brief (or point
the agent at it), and work through the phases **in order**. Don't let the
agent jump to the frontend before Phase 2–4 are solid — a pretty dashboard on
top of a broken scheduler fails the assignment. After each phase, ask the
agent to summarize what it built and run the "Acceptance check" before moving
on.

Always keep `AGENTS.md` open/attached alongside this file — it holds the
constraints this plan assumes.

---

## Phase 0 — Clarify before building (do this first, in chat, not in code)

Ask me these before writing any code, or state the assumption and proceed if
I don't answer immediately:

1. Postgres or MySQL? (default: Postgres + Prisma if I don't specify)
2. Do I have a real Figma link, or should you design the dashboard yourself
   in a clean modern style? (default: design it yourself, note it as an
   assumption in the README)
3. Do I have real Google OAuth and Slack OAuth app credentials ready, or
   should you scaffold the integration with placeholder env vars first and
   wire real credentials in later? (default: scaffold first)
4. Local Docker Compose for Redis/Postgres/Elasticsearch, or do I already
   have these running somewhere? (default: Docker Compose)

**Acceptance check:** you have explicit answers or stated defaults for all
four before any code is generated.

---

## Phase 1 — Repo & infra scaffolding

- Initialize the monorepo structure from `AGENTS.md` §4.
- `docker-compose.yml` with Redis, Postgres (or MySQL), and Elasticsearch,
  each with healthchecks and named volumes.
- Backend `package.json` with TypeScript, Express, BullMQ, ioredis, the ORM,
  `@elastic/elasticsearch`, `nodemailer` (for Ethereal), `zod`, `dotenv`.
- `.env.example` for backend and frontend, every variable commented.
- `tsconfig.json` in strict mode for both apps.
- A `README.md` skeleton with the sections required in the submission
  guidelines (run instructions, architecture overview, features table,
  assumptions) — fill it in progressively as you build, don't leave it for
  the end.

**Acceptance check:** `docker compose up` brings up Redis/DB/ES healthy;
`npm run dev` in `/backend` boots an Express server that responds on
`/health`.

---

## Phase 2 — Data model & DB layer

Design and migrate tables for at least:
- `users` (id, google_id, email, name, avatar_url, created_at)
- `senders` (id, tenant/user_id, ethereal_email, ethereal_password_hash or
  transport config, created_at)
- `scheduled_emails` (id, user_id, sender_id, recipient_email, subject, body,
  scheduled_at, status: `pending|processing|sent|failed|rescheduled`,
  job_id (BullMQ job id, unique), attempts, created_at, updated_at)
- `slack_integrations` (id, user_id, access_token or webhook_url, team_id,
  connected_at)
- `rate_limit_config` (id, user_id or sender_id, max_per_hour, min_delay_ms)

Use a real migration tool (Prisma Migrate / Drizzle Kit), not manual SQL run
by hand.

**Acceptance check:** migrations run clean from scratch; you can insert and
query each table via a quick script.

---

## Phase 3 — Scheduler core (the heart of the grade)

1. **Producer**: API endpoint `POST /api/emails/schedule` accepts
   `{ senderId, recipients[], subject, body, startTime, delayBetweenMs,
   hourlyLimit }`. For each recipient:
   - Insert a `scheduled_emails` row with status `pending`.
   - Enqueue a BullMQ delayed job with `jobId = scheduled_emails.id` (this
     *is* your idempotency key — BullMQ refuses duplicate job IDs), `delay`
     computed from `startTime` + position × `delayBetweenMs`.
2. **Worker** (`worker.ts`, separate process): concurrency read from
   `WORKER_CONCURRENCY` env var. On each job:
   - Check current DB status is still `pending`/`processing` before sending
     (guards against duplicate delivery if a job is retried).
   - Check the sender's Redis-backed hourly counter
     (`INCR sender:{id}:{hourWindow}` + `EXPIRE`). If under limit, send via
     Ethereal SMTP, mark `sent`, index into Elasticsearch.
   - If at/over limit: **do not fail the job** — compute the next open hour
     window, update `scheduled_at`, re-enqueue with the new delay (same
     `jobId` semantics — remove and re-add, or use BullMQ's `moveToDelayed`),
     set status `rescheduled`, and fire the Slack notification (see Phase 5).
3. **Restart survivability**: because jobs live in Redis (persisted via
   BullMQ + Redis AOF/RDB) and DB status is source of truth, verify explicitly
   — schedule a job 2 minutes out, kill the worker process, restart it, and
   confirm the email still sends at the right time exactly once.
4. **Bull Board**: mount at `/admin/queues` behind the same auth middleware,
   showing live job counts (waiting/active/delayed/completed/failed).

**Acceptance check:** schedule 5 emails with staggered times, kill and
restart both server and worker mid-flight, confirm all 5 send exactly once at
correct times, and Bull Board shows accurate live state throughout.

---

## Phase 4 — Elasticsearch indexing & search

- On every status transition (`pending → sent`, etc.), upsert a document into
  an `emails` index with recipient, subject, body (or a snippet), status,
  scheduled_at, sent_at, sender.
- `GET /api/emails/search?q=...&status=...` queries ES and returns matches.
- Handle ES being briefly unavailable without crashing the worker (log +
  continue; don't block sending on indexing).

**Acceptance check:** searching a keyword from a sent email's subject/body
returns it via the search endpoint.

---

## Phase 5 — Slack OAuth + rate-limit notifications

- `GET /api/slack/connect` redirects to Slack's OAuth authorize URL.
- `GET /api/slack/callback` exchanges the code for a token, stores it in
  `slack_integrations` keyed by user.
- A small `notifySlack(userId, message)` service: look up the integration; if
  none exists, no-op silently (no crash, no error surfaced to the sender
  flow); if one exists, post the message live via the Slack Web API or
  webhook.
- Wire this into the worker's "hourly limit hit" branch from Phase 3.
- Support disconnect (delete the row) and reconnect without a redeploy —
  purely data-driven, no restart required.

**Acceptance check:** with Slack connected, hitting the hourly cap in a test
run produces a real message in the connected Slack channel within seconds;
with Slack disconnected, the same scenario logs cleanly with no crash.

---

## Phase 6 — Google OAuth (frontend + backend)

- Backend: standard Authorization Code flow, exchange code for tokens,
  fetch userinfo, upsert into `users`, issue a session (httpOnly cookie with
  JWT, or equivalent).
- Frontend: "Sign in with Google" button → backend redirect → callback →
  land on dashboard with session established.
- Auth middleware protecting all `/api/*` routes except the OAuth endpoints
  and `/health`.
- Logout clears the session.

**Acceptance check:** full login → dashboard → logout → login again cycle
works with no manual token pasting.

---

## Phase 7 — Frontend dashboard

Build in this order, each as its own component set per `AGENTS.md` §4:
1. **Layout & header** — user avatar/name/email (from session), logout.
2. **Tabs** — Scheduled Emails / Sent Emails.
3. **Compose modal/page** — subject, body, CSV/text upload (parse client-side,
   show detected count before submit), start time, delay-between, hourly
   limit → calls `POST /api/emails/schedule`.
4. **Scheduled table** — email, subject, scheduled time, status; loading
   skeleton; empty state illustration/copy.
5. **Sent table** — email, subject, sent time, status (sent/failed); same
   loading/empty treatment.
6. **Slack connect** button in settings/header, reflecting connected state.
7. Toasts/inline errors for failed API calls.

Keep components reusable (`<Table>`, `<Button>`, `<Modal>`, `<EmptyState>`) —
don't hand-roll one-off markup per screen.

**Acceptance check:** every documented user flow in the assignment (login →
compose → see it appear as scheduled → see it move to sent) works by
clicking through the actual UI, not just via Postman.

---

## Phase 8 — Load-behavior write-up (no code required, but must be explicit)

In the README's architecture section, explain in plain language:
- What happens when 1000+ emails are scheduled for the same instant (queue
  depth, delayed-job spread, DB write pattern).
- What happens when the hourly cap would be exceeded mid-burst (rescheduling
  logic, order preservation, Slack notification firing once per breach, not
  once per job).

Optionally demonstrate with a seed script that enqueues a large batch against
a low `MAX_EMAILS_PER_HOUR` and shows jobs shifting into later windows in Bull
Board.

---

## Phase 9 — README, demo video, submission

- Finalize README: run instructions (backend, worker, frontend, Docker,
  Ethereal setup, env vars), architecture overview (scheduling, persistence,
  rate limiting/concurrency), features-implemented table, assumptions/
  shortcuts/trade-offs.
- Record the ≤5 min demo: schedule emails → dashboard scheduled/sent views →
  restart demo (stop server, restart, show future email still sends
  correctly) → brief rate-limit-under-load demonstration.
- Create the private GitHub repo, grant access to the specified accounts,
  push, and fill out the submission form linked in the assignment.

**Final acceptance check — read this back before submitting:**
- [ ] No cron anywhere in the codebase.
- [ ] Restart test passed (no duplicate sends, no dropped future sends).
- [ ] Rate limit is Redis/DB-backed, not in-memory.
- [ ] Hitting the cap reschedules rather than drops/fails jobs.
- [ ] Slack message is a live call, verified in an actual Slack channel.
- [ ] Google OAuth is a real flow, not mocked.
- [ ] Elasticsearch search endpoint returns real results.
- [ ] Bull Board is live and reachable.
- [ ] README and demo video both exist and match what's actually in the repo.