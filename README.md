# ReachInbox — Production-Grade Email Scheduler

A robust, fault-tolerant, horizontally scalable email scheduling engine and dashboard built for high reliability, idempotency, cross-worker safe rate limiting, and restart survivability.

---

## 🏗️ Architecture Overview

The system is architected as a clean monorepo with strict separation of concerns between API ingestion, persistent state management, delayed queue orchestration, asynchronous worker execution, and real-time frontend monitoring.

```mermaid
flowchart TD
    User([User / Browser]) <--> Frontend[Frontend Dashboard - React + Tailwind]
    Frontend <-->|REST API / JWT Session| API[API Server - Express + TypeScript]
    
    subgraph Storage & Persistence
        DB[(PostgreSQL 16 - Prisma ORM)]
        Redis[(Redis 7 - Append-Only File AOF)]
        ES[(Elasticsearch 8.15 Indexer)]
    end

    subgraph Queue Engine
        Queue[BullMQ Delayed Queue]
        Limiter[Redis Hourly Window Limiter]
        BullBoard[Bull Board UI - /admin/queues]
    end

    subgraph Worker Process
        Worker[Email Worker Process - worker.ts]
    end

    subgraph External Integrations
        Ethereal[Ethereal SMTP Sandbox]
        Slack[Slack OAuth2 & Webhooks]
        Google[Google OAuth 2.0 Auth Code Grant]
    end

    API -->|1. Store PENDING status| DB
    API -->|2. Enqueue delayed job| Queue
    API -->|Authenticate| Google
    API -->|Connect / Callback| Slack
    API -->|Dashboard stats| BullBoard
    
    Queue <--> Redis
    BullBoard <--> Queue
    Limiter <--> Redis
    
    Worker -->|Fetch next job| Queue
    Worker -->|Atomic status check| DB
    Worker -->|Evaluate & increment count| Limiter
    Worker -->|Send email via SMTP| Ethereal
    Worker -->|Index search log| ES
    Worker -->|Alert on cap breach| Slack
    Worker -->|Update SENT / RESCHEDULED| DB
```

### Component Boundaries
- **API Server (`apps/backend/src/server.ts`)**: Thin Express controllers handling input validation (Zod schemas), Google/Slack OAuth flows, session management (HTTP-only signed JWT cookies), and delayed batch enqueuing.
- **Queue Engine (`apps/backend/src/queues`)**: BullMQ backed by Redis 7 with **Append-Only File (AOF) persistence** enabled (`--appendonly yes`). Manages delayed job timers with millisecond precision without OS cron or in-memory timers.
- **Worker Process (`apps/backend/src/worker.ts`)**: Decoupled, horizontally scalable worker process that pulls ready jobs, enforces strict DB-level idempotency guards, evaluates Redis atomic rate counters, dispatches via Ethereal SMTP, and handles auto-rescheduling.
- **Database (`apps/backend/prisma`)**: PostgreSQL 16 managed via Prisma ORM as the single source of truth for user profiles, sender SMTP configs, scheduled email state transitions, rate limit policies, and Slack OAuth tokens.
- **Search Engine (`apps/backend/src/integrations/elasticsearch`)**: Elasticsearch indexer with seamless fallback to PostgreSQL full-text search if Elasticsearch is temporarily offline.
- **Queue Monitoring (`apps/backend/src/admin/bull-board.ts`)**: Live Bull Board mounted at `/admin/queues` providing real-time visibility into waiting, active, delayed, completed, and failed jobs.
- **Frontend (`apps/frontend`)**: Clean modern dashboard featuring real-time Scheduled and Sent tables, recipient batch composer with CSV parsing, instant search, and Slack integration management.

---

## 🔒 Hard Constraints & Architectural Guarantees

| Requirement | Implementation Guarantee |
|---|---|
| **No Cron** | Strictly uses **BullMQ delayed jobs** with Redis sorted sets (`zset`). No `node-cron`, `agenda`, OS crontab, or `setInterval` pseudo-schedulers. |
| **Restart Survivability** | Redis AOF persistence guarantees jobs survive process crashes. The DB status is the source of truth (`PENDING` -> `PROCESSING` -> `SENT`). Verified via automated crash simulation test `npm run test:restart`. |
| **Idempotency** | Every BullMQ job is keyed with `jobId = scheduled_emails.id`. BullMQ refuses duplicate job IDs. Workers atomically claim jobs via `UPDATE ... SET status='PROCESSING' WHERE status IN ('PENDING', 'RESCHEDULED')` ensuring zero duplicate delivery. |
| **Cross-Worker Safe Rate Limiting** | Uses Redis-backed atomic pipelines (`INCR` + `EXPIRE`) keyed by `ratelimit:sender:{id}:{YYYYMMDDHH}`. Never relies on worker in-memory state. |
| **No Dropped Jobs on Cap Breach** | When an hourly cap is reached, the worker calculates the next hour window (`getNextHourWindow`), updates the DB status to `RESCHEDULED`, re-enqueues the job with the calculated delay, and triggers a throttled Slack alert. Send order is preserved. |
| **Real OAuth Flows** | Google OAuth 2.0 Authorization Code grant exchanging authorization code for access tokens and user profiles. Slack OAuth 2.0 storing per-user webhook and token credentials. |

---

## ⚡ Load-Behavior Analysis (Phase 8 Deep Dive)

### 1. What happens when 1,000+ emails are scheduled for the exact same instant?
1. **API Ingestion & Queue Depth**:
   - The producer endpoint `POST /api/emails/schedule` accepts the batch payload and processes it in a fast sequential loop.
   - For 1,000 recipients, 1,000 database rows are created in `scheduled_emails` with status `PENDING`.
   - 1,000 BullMQ jobs are enqueued into Redis with `jobId = scheduled_email.id`. If a base `startTime` is specified with `delayBetweenMs` (e.g. 2000ms), each recipient is enqueued with an incremental delay `delay = i * delayBetweenMs`.
   - If all 1,000 emails are scheduled for the exact same millisecond (`delay = 0`), BullMQ places all 1,000 jobs into the Redis `wait` list immediately.
2. **Delayed-Job Spread & Memory Footprint**:
   - BullMQ stores delayed jobs in a Redis sorted set (`zset`) scored by Unix timestamp. Redis easily accommodates millions of elements in sorted sets with O(log N) insertion and removal complexity.
   - Workers consume jobs in batches determined by `WORKER_CONCURRENCY` (configurable via environment variable, default: `5`).
3. **Database Write Patterns & Lock Minimization**:
   - Each worker atomically claims a single job using an isolated atomic update:
     `UPDATE "scheduled_emails" SET "status" = 'PROCESSING', "attempts" = "attempts" + 1, "updated_at" = NOW() WHERE "id" = $1 AND "status" IN ('PENDING', 'RESCHEDULED');`
   - This row-level lock ensures that even with 50 concurrent worker processes running across multiple machines, no two workers can ever claim or send the same scheduled email.

---

### 2. What happens when the hourly cap is exceeded mid-burst?
1. **Redis Window Counter Evaluation**:
   - Before attempting SMTP transmission, the worker executes an atomic Redis pipeline:
     `INCR ratelimit:sender:<sender_id>:<YYYYMMDDHH>`
     `EXPIRE ratelimit:sender:<sender_id>:<YYYYMMDDHH> 7200`
   - Because `INCR` is atomic in single-threaded Redis, concurrent workers cannot race.
2. **Rescheduling Logic (Zero Job Dropping)**:
   - When the returned counter exceeds `maxPerHour` (e.g. email #51 when the limit is 50):
     - The worker immediately identifies the breach and **does not fail or drop the job**.
     - It computes `nextWindowAt` (the start of the upcoming UTC hour, e.g. `20:00:00.000Z`) and the exact delay in milliseconds `delayMs = nextWindowAt - now`.
     - The database record status is updated to `RESCHEDULED` with `scheduledAt = nextWindowAt`.
     - A new delayed job is enqueued in BullMQ with `delay = delayMs`.
3. **FIFO Order Preservation**:
   - Subsequent emails in the burst will similarly breach the counter (count = 52, 53, 54...) and be assigned `nextWindowAt` with incremental offsets, preserving their relative dispatch order in the next hour window.
4. **Slack Alert Throttling (One Alert Per Breach Event)**:
   - When the counter first breaches the limit (`count === maxPerHour + 1`), an asynchronous alert is dispatched to the user's connected Slack channel via `notifyRateLimitBreach`.
   - Alerts are keyed per sender window so notifications fire once upon breach transition rather than flooding Slack.

---

## 📋 Features & Implementation Status

| Phase | Feature / Requirement | Status | Verification & Deliverables |
|---|---|---|---|
| **Phase 1** | Monorepo & Infra Skeleton | ✅ Completed | Docker Compose (Postgres 16, Redis 7 AOF, Elasticsearch 8.15), Express + TypeScript skeleton, strict tsconfig, healthcheck `/health`. |
| **Phase 2** | Data Model & DB Layer | ✅ Completed | Prisma ORM migrations, schemas for `User`, `Sender`, `ScheduledEmail`, `SlackIntegration`, `RateLimitConfig`, cascading deletes, unique job ID constraints. Tested via `npm run test:db`. |
| **Phase 3** | Scheduler Core | ✅ Completed | BullMQ delayed jobs, zero cron, atomic DB idempotency guard, Redis-backed rate limiter, auto-rescheduling into next hour window, restart survivability. Tested via `npm run test:scheduler` & `npm run test:restart`. |
| **Phase 4** | Elasticsearch Indexing & Search | ✅ Completed | Full-text indexing of sent and scheduled emails across subject, body, sender, recipient. Multi-match search endpoint `/api/emails/search` with seamless PostgreSQL ILIKE fallback if ES is offline. Tested via `npm run test:search`. |
| **Phase 5** | Slack OAuth & Alerts | ✅ Completed | Real Slack OAuth authorization code flow (`/api/slack/connect`, `/api/slack/callback`), database-backed token and webhook storage, disconnect/status endpoints, automated live rate limit alerts. Tested via `npm run test:slack`. |
| **Phase 6** | Google OAuth 2.0 & Session | ✅ Completed | Standard Authorization Code flow exchanging code for Google tokens/profile, signed JWT sessions in HTTP-only cookies and Bearer headers, `requireAuth` middleware protecting all `/api/*` routes. Tested via `npm run test:auth`. |
| **Phase 7** | Frontend Dashboard | ✅ Completed | Modern React + Tailwind CSS dashboard: Scheduled Outbox & Sent tabs, recipient batch composer with client-side CSV parsing, search bar, Slack status indicator, Bull Board direct links. |
| **Phase 8** | Load-Behavior Analysis | ✅ Completed | Plain-language architectural write-up on 1000+ burst handling, queue depths, DB locking patterns, Redis rate counter mechanics, and order preservation. |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18.x or v20.x+
- **Docker & Docker Compose** (for Redis, PostgreSQL, and Elasticsearch)

### 2. Start Infrastructure Services
From the root directory, launch all infrastructure containers:
```bash
docker compose up -d
```
Verify containers are healthy:
```bash
docker ps
```
Services exposed:
- **PostgreSQL 16**: `localhost:5432`
- **Redis 7 (AOF enabled)**: `localhost:6379`
- **Elasticsearch 8.15**: `localhost:9200`

---

### 3. Backend Setup & Run

1. Navigate to the backend workspace:
   ```bash
   cd apps/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Start the API Server:
   ```bash
   npm run dev
   ```
   - The API server will listen on `http://localhost:4000`.
   - Bull Board dashboard will be available at `http://localhost:4000/admin/queues`.
   - Health check: `curl http://localhost:4000/health` -> `{"status":"ok","db":true,"redis":true}`.

5. Start the Dedicated Queue Worker (in a separate terminal):
   ```bash
   cd apps/backend
   npm run worker
   ```

---

### 4. Frontend Setup & Run

1. Navigate to the frontend workspace:
   ```bash
   cd apps/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build or start the development server:
   ```bash
   npm run dev
   ```
   - Open your browser at `http://localhost:3000`.

---

## 🧪 Automated Acceptance Test Suite

The backend includes comprehensive automated end-to-end test suites that verify each phase's acceptance criteria:

```bash
cd apps/backend

# 1. Verify Database layer, models, relations, cascades, and unique constraints
npm run test:db

# 2. Verify Scheduler core, staggered batch dispatch, and rate-limit auto-rescheduling
npm run test:scheduler

# 3. Verify Restart Survivability (worker killed mid-delay, restarted, job delivers exactly once)
npm run test:restart

# 4. Verify Elasticsearch indexing, keyword queries, and PostgreSQL fallback
npm run test:search

# 5. Verify Slack OAuth connection, live webhook alerts, status checks, and disconnect
npm run test:slack

# 6. Verify Google OAuth authorization, signed JWT sessions, route protection, and logout
npm run test:auth

# 7. Verify all HTTP REST API endpoints end-to-end
npm run test:api
```

---

## ⚙️ Environment Variables Reference

A fully documented `.env.example` file is included in both root and `apps/backend`:

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port for the Express backend API |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`) |
| `DATABASE_URL` | `postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URI for BullMQ and rate limiting |
| `WORKER_CONCURRENCY` | `5` | Maximum number of concurrent jobs processed per worker process |
| `MIN_DELAY_MS` | `2000` | Enforced minimum delay between consecutive emails in a batch |
| `MAX_EMAILS_PER_HOUR_PER_SENDER`| `50` | Default hourly dispatch threshold per sender |
| `ELASTICSEARCH_URL`| `http://localhost:9200` | Elasticsearch cluster endpoint |
| `GOOGLE_CLIENT_ID` | `placeholder_google_client_id` | Google OAuth 2.0 Web Application Client ID |
| `GOOGLE_CLIENT_SECRET` | `placeholder_google_client_secret` | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4000/api/auth/google/callback` | Authorized OAuth redirect URI |
| `SLACK_CLIENT_ID` | `placeholder_slack_client_id` | Slack OAuth App Client ID |
| `SLACK_CLIENT_SECRET` | `placeholder_slack_client_secret` | Slack OAuth App Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:4000/api/slack/callback` | Slack OAuth redirect URI |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` | Fallback Slack Incoming Webhook URL |
| `NEXTAUTH_SECRET` | `reachinbox_super_secret_jwt_key` | Secret key used to sign and verify session JWTs |
| `NEXTAUTH_URL` | `http://localhost:3000` | Frontend dashboard origin for CORS and OAuth redirection |

---

## 📝 Assumptions & Design Decisions

1. **Clean Modern UI (No Figma Link)**: Designed with a modern, high-contrast dark aesthetic using Tailwind CSS and Lucide icons, providing intuitive tabbed navigation between Scheduled Outbox and Sent History, an interactive Compose Modal with CSV parsing, and visual Slack connectivity badges.
2. **Local Infrastructure via Docker Compose**: Redis 7 runs with Append-Only File (`--appendonly yes`) enabled to guarantee delayed job survivability across container restarts. PostgreSQL 16 runs with healthchecks and named volumes.
3. **Elasticsearch Graceful Degradation**: If Elasticsearch is offline or unreachable during local development, the indexing hook logs a warning non-blockingly without halting email delivery. Search queries seamlessly fall back to PostgreSQL full-text search (`ILIKE`).
4. **OAuth Sandbox / Dev Login Mode**: In development environments without real Google OAuth credentials, a `POST /api/auth/dev-login` endpoint generates valid signed sessions, and simulated OAuth callbacks allow full end-to-end testing of authentication flows without manual token pasting.
5. **Ethereal Sandbox SMTP**: All emails are dispatched through Ethereal sandbox SMTP accounts created automatically per sender, generating real preview URLs viewable in worker logs and API responses.
