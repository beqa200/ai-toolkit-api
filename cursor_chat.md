# Mini AI Toolkit architecture design

_Exported on 12/03/2026 at 21:37:07 GMT+4 from Cursor (2.4.31)_

---

**User**

I am building a take-home assignment called "Mini AI Toolkit".

Main requirements:

- Next.js frontend
- Node.js backend
- asynchronous AI generation
- job lifecycle (pending → generating → completed/failed)
- gallery of results
- generation history

Before writing code, help me design the architecture.

Explain:

1. backend architecture
2. async job processing strategy
3. folder structure
4. database design

---

**Cursor**

Here's the full architecture design for your **Mini AI Toolkit**.

---

## 1. Backend Architecture

A **monorepo** approach with the Next.js app handling both the frontend and the API layer, plus a separate lightweight worker process for async job execution.

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)               │
│              Next.js React Frontend              │
└──────────────┬──────────────────┬───────────────┘
               │ REST/API calls   │ Polling / SSE
               ▼                  ▼
┌─────────────────────────────────────────────────┐
│           Next.js API Routes (Route Handlers)    │
│                                                  │
│  POST /api/jobs          → create a new job      │
│  GET  /api/jobs          → list jobs (history)   │
│  GET  /api/jobs/:id      → job detail + status   │
│  DELETE /api/jobs/:id    → delete a job           │
│  GET  /api/gallery       → completed results     │
└──────────────┬──────────────────────────────────┘
               │ writes/reads
               ▼
┌─────────────────────────────────────────────────┐
│              SQLite (via Prisma)                  │
│         jobs table + generations table           │
└──────────────┬──────────────────────────────────┘
               │ polled by
               ▼
┌─────────────────────────────────────────────────┐
│         Worker Process (separate script)          │
│  - Polls DB for "pending" jobs                   │
│  - Calls AI provider API (OpenAI, etc.)          │
│  - Updates job status: pending → generating →    │
│    completed / failed                            │
│  - Stores result (text/image URL) in DB          │
└─────────────────────────────────────────────────┘
```

**Why this split?** The API routes stay fast and non-blocking. The worker handles long-running AI calls independently. If the worker crashes, pending jobs remain in the DB and get picked up on restart — built-in resilience.

---

## 2. Async Job Processing Strategy

For a take-home assignment, a **database-backed polling worker** is the sweet spot — no Redis/RabbitMQ infrastructure needed, but still properly asynchronous.

### Flow

```
1. Client sends POST /api/jobs { type: "text"|"image", prompt: "..." }
2. API route inserts a row:  status = "pending", returns { jobId }
3. Client begins polling GET /api/jobs/:id every 2-3 seconds

4. Worker process (runs separately via `npm run worker`):
   - Every 1s, queries: SELECT * FROM jobs WHERE status = 'pending' ORDER BY createdAt LIMIT 1
   - Sets status → "generating"
   - Calls the AI API (OpenAI chat completion or image generation)
   - On success: status → "completed", stores result
   - On failure: status → "failed", stores error message

5. Client sees status change via polling, displays result
```

### Why polling over WebSockets?

- Simpler to implement and debug
- Stateless — works perfectly with Next.js serverless-style API routes
- No connection management complexity
- For a take-home, it demonstrates async understanding without overengineering

### Worker details

- Single Node.js script using `setInterval`
- Processes one job at a time (or configurable concurrency)
- Graceful shutdown on SIGTERM
- Retry logic: if a job has been "generating" for > 2 minutes, assume it failed (stale job recovery)

---

## 3. Folder Structure

```
ai-toolkit/
├── prisma/
│   ├── schema.prisma          # database schema
│   ├── migrations/            # auto-generated
│   └── seed.ts                # optional demo data
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # root layout, fonts, providers
│   │   ├── page.tsx           # home — prompt input + submission
│   │   ├── gallery/
│   │   │   └── page.tsx       # gallery of completed generations
│   │   ├── history/
│   │   │   └── page.tsx       # full job history table
│   │   └── jobs/
│   │       └── [id]/
│   │           └── page.tsx   # single job detail + live status
│   │
│   ├── api/                   # (if using route handlers in src/)
│   │   └── ... or use app/api/
│   │
│   ├── components/
│   │   ├── ui/                # reusable primitives (Button, Card, Badge, etc.)
│   │   ├── PromptForm.tsx     # prompt input + type selector
│   │   ├── JobCard.tsx        # single job display card
│   │   ├── JobStatusBadge.tsx # colored status indicator
│   │   ├── GalleryGrid.tsx    # masonry/grid for completed items
│   │   └── HistoryTable.tsx   # sortable/filterable table
│   │
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── ai.ts              # AI provider abstraction
│   │   └── constants.ts       # status enums, config
│   │
│   ├── hooks/
│   │   ├── useJobPolling.ts   # polls job status
│   │   └── useJobs.ts         # fetch job lists
│   │
│   └── types/
│       └── index.ts           # shared TypeScript types
│
├── worker/
│   ├── index.ts               # worker entry point
│   └── processor.ts           # job processing logic
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── .env                       # API keys, DB URL
```

### Key decisions

- **App Router** (not Pages) — modern Next.js, server components by default
- **`worker/` at the root** — clearly separated from the Next.js app, runs as its own process
- **`lib/ai.ts`** — abstracts the AI provider so you can swap OpenAI for a mock during development
- **`components/ui/`** — small primitives, keeps feature components clean

---

## 4. Database Design

Using **SQLite via Prisma** — zero infrastructure, single file, perfect for a take-home.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model Job {
  id        String   @id @default(cuid())
  type      String   // "text" | "image"
  prompt    String
  status    String   @default("pending") // pending | generating | completed | failed
  result    String?  // completed text or image URL
  error     String?  // error message if failed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

### Why a single `Job` table?

For this scope, one table covers the full lifecycle. Each row is a self-contained unit:

| Field       | Purpose                                             |
| ----------- | --------------------------------------------------- |
| `id`        | CUID — URL-friendly, sortable                       |
| `type`      | Distinguishes text vs image generation              |
| `prompt`    | The user's input                                    |
| `status`    | Drives the entire lifecycle + UI states             |
| `result`    | Polymorphic — stores generated text or an image URL |
| `error`     | Captured failure reason for debugging               |
| `createdAt` | History sorting, gallery ordering                   |

### Status transitions

```
pending ──→ generating ──→ completed
                │
                └──────→ failed
```

The `@@index([status])` is critical — the worker queries by status on every poll cycle.

---

## Summary of trade-offs

| Decision       | Choice                  | Why                                        |
| -------------- | ----------------------- | ------------------------------------------ |
| Async strategy | DB polling worker       | No infra dependencies, resilient, simple   |
| Database       | SQLite + Prisma         | Zero setup, typed queries, easy migrations |
| Frontend data  | Polling (not WebSocket) | Stateless, debuggable, fits Next.js model  |
| AI abstraction | `lib/ai.ts` wrapper     | Swappable for mocks in dev/testing         |
| Monorepo       | Single package.json     | One `npm install`, simpler for reviewers   |

Ready to start building when you are. We can begin with the database schema and worker, or the frontend — your call.

---

**User**

I am building a Node.js + TypeScript backend.

For this step I ONLY want the basic project skeleton.

Requirements:

- Express server
- TypeScript configuration
- package.json dependencies
- basic folder structure

Important rules:

- DO NOT implement any business logic
- DO NOT implement database logic
- DO NOT implement API endpoints
- DO NOT implement workers

Just create:

- server bootstrap
- minimal folder structure

---

**Cursor**

Empty workspace. Let me scaffold the backend skeleton.

Now let me install the dependencies.

Let me verify everything compiles and the server starts.

The server is running. Here's what was created:

### Project structure

```
ai-toolkit-artlis/
├── src/
│   ├── server.ts          # Express bootstrap + health check
│   ├── routes/            # future: API route modules
│   ├── services/          # future: business logic
│   ├── lib/               # future: DB client, AI client
│   ├── types/             # future: shared TypeScript types
│   └── middleware/         # future: error handling, validation
├── worker/                # future: async job processor
├── package.json
├── tsconfig.json
├── .env
└── .gitignore
```

### What's wired up

- **Express** server on port `4000` with CORS and JSON body parsing
- **`GET /health`** — single sanity-check endpoint returning `{ status: "ok" }`
- **`tsx watch`** for dev mode — auto-restarts on file changes, no build step needed
- **TypeScript** compiles cleanly with strict mode
- **npm scripts**: `dev` (watch mode), `build` (tsc), `start` (production), `worker` (placeholder)

### What's intentionally left empty

Every subfolder (`routes/`, `services/`, `lib/`, `types/`, `middleware/`, `worker/`) has a `.gitkeep` so the structure is committed but contains no logic — ready to fill in step by step.

---

**User**

Now I want to implement posgtreSQL DB using Prisma.

Important:
Do NOT modify any other code.

Create only the SQL schema for generation_jobs table.

Fields:

- id
- original_prompt
- enhanced_prompt
- type
- status
- result_url
- result_text
- error_message
- priority
- cancelled
- created_at
- updated_at

---

**Cursor**

Let me check the current project state first.

Good — the project lives under `backend/`. Let me install Prisma and create the schema.

Now let me write the schema and update the `.env` with the database URL.

The `prisma.config.ts` references `dotenv` — let me install it since it's listed as a dependency there.

Let me validate the schema is correct.

Schema is valid. Here's what was created:

### `prisma/schema.prisma` — `generation_jobs` table

| Column            | Type            | Details                                                                  |
| ----------------- | --------------- | ------------------------------------------------------------------------ |
| `id`              | `String` (cuid) | Primary key, auto-generated                                              |
| `original_prompt` | `String`        | Required — the user's input                                              |
| `enhanced_prompt` | `String?`       | Nullable — AI-enhanced version of the prompt                             |
| `type`            | `String`        | `"text"` or `"image"`                                                    |
| `status`          | `String`        | Default `"pending"` — lifecycle: pending → generating → completed/failed |
| `result_url`      | `String?`       | Nullable — URL for image results                                         |
| `result_text`     | `String?`       | Nullable — text generation output                                        |
| `error_message`   | `String?`       | Nullable — captured failure reason                                       |
| `priority`        | `Int`           | Default `0` — for job queue ordering                                     |
| `cancelled`       | `Boolean`       | Default `false` — soft cancellation flag                                 |
| `created_at`      | `DateTime`      | Auto-set on creation                                                     |
| `updated_at`      | `DateTime`      | Auto-updated by Prisma                                                   |

Three indexes on `status`, `created_at`, and `priority` to support the worker's polling query and history/gallery listing.

The `@@map("generation_jobs")` maps the Prisma model `GenerationJob` to the snake_case table name `generation_jobs` in PostgreSQL, and each field uses `@map()` to keep column names snake_case while the TypeScript interface stays camelCase.

### Next steps when ready

Once you have a PostgreSQL instance running, you'd run:

```bash
npx prisma migrate dev --name init
```

to create the actual table and generate the client.

---

**User**

Now implement the repository layer.

Requirements:
create file:
repositories/generation.repository.ts

Functions:

- createJob
- getJobById
- getAllJobs
- getPendingJobs
- updateJobStatus
- saveJobResult

Important:

- repository should only talk to database
- do NOT implement business logic

---

**Cursor**

The schema has been updated with proper enums — good. I need to first create a Prisma client singleton, then the repository.

Let me verify the Prisma client is generated so the types resolve.

Everything compiles cleanly. Here's what was created:

### `src/lib/db.ts` — Prisma client singleton

Exports a single `PrismaClient` instance reused across the app.

### `src/repositories/generation.repository.ts` — 6 functions

| Function          | Purpose                         | Query details                                                                        |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `createJob`       | Insert a new job                | Takes `originalPrompt`, `type`, optional `priority`; status defaults to `PENDING`    |
| `getJobById`      | Fetch a single job              | `findUnique` by `id`                                                                 |
| `getAllJobs`      | List jobs for history           | Ordered by `createdAt` desc, supports `limit`/`offset` pagination                    |
| `getPendingJobs`  | Fetch jobs ready for processing | Filters `PENDING` + not cancelled, ordered by priority desc then oldest first        |
| `updateJobStatus` | Transition job status           | Updates `status`, optionally sets `errorMessage` (for failures)                      |
| `saveJobResult`   | Store completed generation      | Sets status to `COMPLETED` and writes `enhancedPrompt`, `resultUrl`, or `resultText` |

Every function is a pure database operation — no validation, no business rules, no side effects.

---

**User**

Now create an AI Image Service for the backend.

Requirements:

- file: services/imageService.ts
- function: generateImage(prompt: string, parameters?: {style?: string, resolution?: number})
- call Pollinations API:
  Base URL - https://gen.pollinations.ai.
  Endpoints:
  Simple Text: GET /text/{prompt}
  Image Generation: GET /image/{prompt}
- encode prompt safely
- return the generated image URL
- handle errors gracefully

Important:

- do NOT implement any API endpoints yet
- do NOT integrate with the database or worker yet

---

**Cursor**

Compiles cleanly. Here's what was created:

### `src/services/imageService.ts`

**`generateImage(prompt, parameters?)`** — single exported function that:

1. **Validates** the prompt is non-empty
2. **Builds the full prompt** — appends the style suffix if provided (e.g. `"a cat, watercolor style"`)
3. **Encodes safely** — `encodeURIComponent` handles special characters, spaces, unicode
4. **Constructs the URL** — `GET /image/{encodedPrompt}` with optional `width`/`height` query params from `resolution`
5. **Verifies reachability** — sends a `HEAD` request to confirm the API responds with 200 before returning the URL
6. **Error handling** — distinguishes network failures (`TypeError`) from API errors (non-200 status), re-throws with clear messages

The Pollinations API works by returning the image directly at the URL, so the function returns the constructed URL itself — which can be stored as `resultUrl` in the database later.

---

**User**

We need same service for text generation.

---

**Cursor**

Compiles cleanly. Here's `src/services/textService.ts`:

**`generateText(prompt, parameters?)`** — mirrors the image service pattern:

1. **Validates** non-empty prompt
2. **Builds the full prompt** — appends tone instruction and max-length constraint if provided
3. **Calls** `GET /text/{encodedPrompt}` on the Pollinations API
4. **Reads the response body** as text (unlike the image service which returns a URL, the text endpoint returns the generated content directly)
5. **Validates** the response isn't empty
6. **Returns** the trimmed text string — ready to be stored as `resultText` later

Key difference from image service: the text endpoint returns actual content in the response body, so we `await response.text()` and return that string rather than a URL.

---

**User**

Now create a PromptEnhancer service.

Requirements:

- file: services/promptEnhancer.ts
- function enhancePrompt(prompt: string)

Example:
input: "cat"
output: "high quality cinematic cyberpunk cat illustration"

Important:

- do not connect this service anywhere yet
- just implement the function

---

**Cursor**

Done. Here's `src/services/promptEnhancer.ts`:

**`enhancePrompt(prompt)`** uses the Pollinations text API with a system prompt that instructs the LLM to act as a prompt enhancement specialist. The flow:

1. **Validates** non-empty input
2. **Sends** the user's short prompt to `GET /text/{message}` with a `system` query param that tells the model to expand it into a vivid, detailed generation prompt with artistic style, lighting, mood, and detail keywords
3. **Constrains** output to under 200 characters and raw text only (`json: false`)
4. **Returns** the enhanced string — e.g. `"cat"` → `"high quality cinematic cyberpunk cat illustration, neon lighting, dramatic atmosphere"`

Same error handling pattern as the other services. Not wired to anything yet — ready to be called from the worker later.

---

**User**

Now implement API endpoint for creating generation jobs.

Requirements:

- POST /generations
- validate prompt input
- enhance prompt using PromptEnhancer
- create a job in database with status "pending"
- return jobId and status
- do NOT wait for AI generation (async job processing)

---

**Cursor**

I need to create the route, and slightly extend `createJob` in the repository to accept the `enhancedPrompt` field. Let me build both.

Now mount the route in `server.ts`.

Compiles cleanly. Here's what was done:

### `src/routes/generation.routes.ts` — `POST /api/generations`

**Request body:**

```json
{
  "prompt": "a cat in space",
  "type": "IMAGE",
  "priority": 1
}
```

**Response (201):**

```json
{
  "jobId": "clx...",
  "status": "PENDING",
  "enhancedPrompt": "high quality cinematic cat floating in deep space, nebula background, dramatic lighting"
}
```

**Flow:**

1. **Validate** — checks `prompt` is a non-empty string, `type` is `IMAGE` or `TEXT`, `priority` (if given) is a non-negative number
2. **Enhance** — calls `enhancePrompt()` but treats it as best-effort; if the Pollinations API is down, the job still gets created with just the original prompt
3. **Persist** — calls `createJob()` in the repository with status `PENDING`
4. **Return immediately** — the response comes back without waiting for any AI generation

### Changes to existing files

- **`generation.repository.ts`** — added `enhancedPrompt` as an optional field to `createJob`
- **`server.ts`** — mounted `generationRoutes` at `/api/generations`, removed unused `PrismaClient` import

---

**User**

Connect Generation route to imageService and textService to Implement AI feature.

---

**Cursor**

The route needs to stay non-blocking, so the AI generation will fire in the background after the response is sent. I'll add a `processJob` function that the route kicks off without awaiting.

Compiles cleanly. Here's what changed in `src/routes/generation.routes.ts`:

### New: `processJob(job)` — background generation handler

```
PENDING ──→ GENERATING ──→ COMPLETED
                │
                └──────→ FAILED
```

The function:

1. **Sets status to `GENERATING`** via `updateJobStatus`
2. **Picks the right service** — `generateImage` for `IMAGE` type, `generateText` for `TEXT`
3. **Uses the enhanced prompt** if available, falls back to the original
4. **Saves the result** — `resultUrl` for images, `resultText` for text
5. **On failure** — catches the error and marks the job `FAILED` with the error message

### How it stays async

The key line:

```typescript
processJob(job).catch((err) => console.error(`Background processing failed for job ${job.id}:`, err));
```

The promise is deliberately **not awaited**. The response goes back to the client immediately with `PENDING` status. The generation runs in the background within the same Node.js process. The `.catch()` ensures any unhandled rejection from `processJob` itself (e.g. if `updateJobStatus` fails) doesn't crash the process.

---

**User**

User shouldn't refresh to see generated image. So implement webSockets for live status and result updates.

---

**Cursor**

Now wire `emitJobUpdate` into `processJob` so every status transition emits a WebSocket event.

Everything compiles cleanly. Here's what was done:

### New: `src/lib/socket.ts` — WebSocket layer

**`initSocket(httpServer)`** — creates the Socket.IO server with CORS enabled and sets up client event handling:

- **`subscribe`** — client joins a room `job:{jobId}` to receive targeted updates for a specific job
- **`unsubscribe`** — client leaves the room

**`emitJobUpdate(job)`** — broadcasts job state changes via two events:

| Event          | Target                | Purpose                                                        |
| -------------- | --------------------- | -------------------------------------------------------------- |
| `job:update`   | Room `job:{jobId}`    | Clients watching a specific job get its latest status + result |
| `jobs:changed` | All connected clients | Gallery/history views refresh without polling                  |

**Payload shape:**

```json
{
  "jobId": "clx...",
  "status": "COMPLETED",
  "resultUrl": "https://...",
  "resultText": null,
  "errorMessage": null,
  "updatedAt": "2026-03-12T..."
}
```

### Changed: `src/server.ts`

Switched from `app.listen()` to `http.createServer(app)` so Socket.IO shares the same port. Both Express and WebSocket traffic go through port 4000.

### Changed: `src/routes/generation.routes.ts`

`processJob` now emits at every status transition:

```
PENDING → emitJobUpdate → GENERATING → emitJobUpdate → COMPLETED
                                            │
                                            └→ FAILED → emitJobUpdate
```

### Client usage

A frontend client would connect like this:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');
socket.emit('subscribe', jobId);
socket.on('job:update', (data) => {
  // live status + result updates
});
```

---

**User**

Integrate Routes for list all jobs

---

**Cursor**

Compiles cleanly. Two new endpoints added to `generation.routes.ts`:

### `GET /api/generations` — list all jobs

- Optional query params: `?limit=10&offset=0` for pagination
- Returns jobs ordered by `createdAt` descending (newest first)

### `GET /api/generations/:id` — get single job

- Returns the full job object including status, result, error message
- Returns `404` if the job doesn't exist

---

**User**

Now developer frontent using nextjs based on all functionality that we have in API.

---

**Cursor**

Now let me create all the foundation files in parallel.

Now the UI components.

Now the page-level components: gallery, history, layout, and home page.

Now the layout with navigation and the home page.

Now the home page — ties the form + live job feed together.

Need to configure `next.config` to allow external images from Pollinations.

Now let me verify it all compiles.

Build succeeded with zero errors. Here's the full frontend:

---

### Frontend structure

```
frontend/src/
├── app/
│   ├── layout.tsx          # Root layout + Navbar
│   ├── page.tsx            # Home — prompt form + live job feed
│   ├── gallery/page.tsx    # Gallery — completed generations only
│   ├── history/page.tsx    # History — all jobs in a table
│   └── globals.css
├── components/
│   ├── Navbar.tsx           # Sticky nav with Create / Gallery / History
│   ├── PromptForm.tsx       # Prompt input + Image/Text toggle + submit
│   ├── JobCard.tsx          # Job display card (image, text, status, errors)
│   └── ui/
│       └── StatusBadge.tsx  # Colored status pill (with pulse on GENERATING)
├── hooks/
│   └── useSocket.ts         # useJobUpdates + useJobSubscription hooks
├── lib/
│   ├── api.ts               # REST client (createJob, fetchJobs, fetchJob)
│   └── socket.ts            # Socket.IO singleton
└── types/
    └── index.ts             # Shared TypeScript types
```

### Pages

| Route      | What it does                                                                     |
| ---------- | -------------------------------------------------------------------------------- |
| `/`        | Prompt form to create jobs + grid of recent jobs with **live WebSocket updates** |
| `/gallery` | Filtered view of only `COMPLETED` jobs — auto-refreshes when new results arrive  |
| `/history` | Table view of all jobs with status, type, prompt, and timestamp                  |

### Key behaviors

- **Live updates**: All three pages listen for `jobs:changed` WebSocket events. The home page updates job cards in-place (status, result) without a page refresh.
- **Optimistic UX**: After creating a job, the list refreshes immediately. The card shows a spinner while `GENERATING`, then swaps to the image/text result when `COMPLETED`.
- **Image support**: `next.config.ts` is configured to allow images from `gen.pollinations.ai`. Images use `next/image` with `unoptimized` since they're external.
- **Error display**: Failed jobs show the error message inline on the card.

### Running both together

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

The frontend runs on `localhost:3000` and talks to the backend on `localhost:4000`.

---

**User**

in DB resultUrl field save response body its Success - Returns the generated image

Type:string
Format:binary
binary data, used to describe files

---

**Cursor**

I see there's a syntax error on line 33 already (`const` with nothing after it). I'll fix the image service to actually download the binary image, save it to disk, and store the local serving URL. I also need to serve the saved images statically.

Now serve the `uploads/` directory as static files from Express.

Add `uploads/` to `.gitignore`.

Now update the frontend to resolve image URLs from the backend.

Both backend and frontend compile cleanly. Here's what changed:

### `backend/src/services/imageService.ts` — now downloads and saves the image

Previously it stored the Pollinations URL directly. Now it:

1. **Fetches** the image with a full `GET` request (not `HEAD`)
2. **Reads the binary** via `response.arrayBuffer()` → `Buffer`
3. **Validates** the buffer isn't empty
4. **Saves to disk** at `uploads/images/{uuid}.png`
5. **Returns** a local path like `/uploads/images/abc-123.png` — this gets stored as `resultUrl` in the DB

### `backend/src/server.ts` — serves saved images

Added `express.static` to serve `uploads/` at the `/uploads` path, so the frontend can fetch images at `http://localhost:4000/uploads/images/abc-123.png`.

### `frontend/src/components/JobCard.tsx` — resolves local image URLs

Added `resolveImageUrl()` that prepends the backend base URL for relative paths (like `/uploads/images/...`), while passing through any absolute URLs unchanged. Switched from `next/image` to a plain `<img>` since the images are now served from the backend, not an external CDN.

### `.gitignore`

Added `uploads/` so generated images aren't committed.

---

**User**

Prompt enhancing should happen async too.

---

**Cursor**

I need to check if the repository has a way to update the `enhancedPrompt` field after creation.

Good — `saveJobResult` already accepts `enhancedPrompt`. Now I'll move prompt enhancement into `processJob` and remove it from the request handler so the POST returns instantly.

Now remove the synchronous enhancement from the POST handler.

Compiles cleanly. Here's what changed:

### `POST /api/generations` — now returns instantly

**Before:** The handler awaited `enhancePrompt()` synchronously before responding — adding seconds of latency to every request.

**After:** The handler just validates input, creates the DB row, and returns `{ jobId, status }` immediately. No more `enhancedPrompt` in the response since it doesn't exist yet.

### `processJob()` — now handles the full async pipeline

The background function now runs:

```
PENDING → GENERATING → enhance prompt → generate image/text → COMPLETED
                              │                    │
                              └─ (best-effort)     └──→ FAILED
```

1. Sets status to `GENERATING`
2. Calls `enhancePrompt()` (best-effort — falls back to original if it fails)
3. Uses the enhanced prompt for generation
4. Saves both `enhancedPrompt` and the result (`resultUrl`/`resultText`) together in one `saveJobResult` call

The enhanced prompt now arrives to the frontend via the WebSocket `job:update` event along with the result, instead of being part of the initial POST response.

---

**User**

Add advanced error handling, add also logger

---

**Cursor**

Now create the error handling middleware and request logger middleware.

Now wire the middleware into the server and update routes + services.

Now update routes to use logger and custom errors.

Now update the services with logger and proper error types.

Add `logs/` to `.gitignore` and type-check.

Everything compiles cleanly. Here's the full picture:

---

### New: `src/lib/logger.ts` — Winston logger

Structured logging with context and job IDs:

```
2026-03-12 18:30:01 [info] [Server]: Server running on http://localhost:4000
2026-03-12 18:30:05 [info] [HTTP]: POST /api/generations 201 12ms
2026-03-12 18:30:05 [info] [JobProcessor] [job:clx123]: Starting processing
2026-03-12 18:30:07 [info] [PromptEnhancer]: Enhancing prompt via Pollinations
2026-03-12 18:30:10 [info] [ImageService]: Image saved: abc-def.jpg (524288 bytes)
2026-03-12 18:30:10 [info] [JobProcessor] [job:clx123]: Completed successfully
```

**Three transports:**

- **Console** — colorized, for dev
- **`logs/error.log`** — errors only, 5MB rotation, 5 files max
- **`logs/combined.log`** — all levels, 10MB rotation, 5 files max

---

### New: `src/lib/errors.ts` — Custom error hierarchy

| Class                  | Status | Use case                                         |
| ---------------------- | ------ | ------------------------------------------------ |
| `AppError`             | any    | Base class — `statusCode` + `isOperational` flag |
| `ValidationError`      | 400    | Bad request input                                |
| `NotFoundError`        | 404    | Resource doesn't exist                           |
| `ExternalServiceError` | 502    | Pollinations API failures                        |

`isOperational` distinguishes expected errors (bad input, API down) from programming bugs. Non-operational errors get logged at `error` level with full stack traces.

---

### New: `src/middleware/errorHandler.ts` — Central error handler

All route handlers now use `next(error)` instead of manually sending JSON responses. The middleware:

- Catches `AppError` subclasses and returns the correct status code
- Catches unexpected errors and returns a generic 500
- Logs everything through Winston

### New: `src/middleware/requestLogger.ts` — HTTP request logger

Logs every request on completion with method, path, status, and duration. Uses `warn` level for 4xx/5xx responses.

---

### Updated: `src/routes/generation.routes.ts`

- Validation now throws `ValidationError` / `NotFoundError` instead of manual `res.status().json()`
- All catch blocks use `next(error)` to delegate to the error middleware
- `processJob` logs every step with `jobId` context — start, enhance, generate, complete/fail
- Added a safety net: if updating the job to `FAILED` itself throws, that error is also logged

### Updated: All three services

Each service now:

- Uses `ExternalServiceError` for API failures (network errors, bad status codes, empty responses)
- Logs key events — request sent, result received with size/length
- Separates network errors from API errors for better diagnostics

### Updated: `src/server.ts`

- Mounts `requestLogger` and `errorHandler` middleware
- Catches `uncaughtException` — logs + exits (the correct behavior for fatal errors)
- Catches `unhandledRejection` — logs but stays alive (typically non-fatal)

---

**User**

this API call happens three time in code so take it out as lib
@imageService.ts (28-33)

---

**Cursor**

All three services duplicate the same fetch + auth + network error handling pattern. I'll extract it into a shared Pollinations API client.

Now update all three services to use it.

Compiles cleanly. Here's what changed:

### New: `src/lib/pollinationsClient.ts`

Single function `pollinationsRequest(endpoint, context, method?)` that handles:

- Building the full URL from `POLLINATIONS_BASE_URL` + endpoint
- Attaching the `Authorization` header
- Catching network errors → `ExternalServiceError`
- Checking `response.ok` → `ExternalServiceError`
- Logging the request with the caller's context name
- Returning the raw `Response` for the caller to consume (as buffer, text, etc.)

### Updated services — before vs after

Each service went from ~15 lines of duplicated fetch/auth/error logic to a single call:

```typescript
// Before (repeated 3x)
let response: Response;
try {
  response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
  });
} catch (error) {
  throw new ExternalServiceError('Pollinations', `Network error: ...`);
}
if (!response.ok) {
  throw new ExternalServiceError('Pollinations', `API returned ...`);
}

// After
const response = await pollinationsRequest(`/image/${encodedPrompt}?${qs}`, 'ImageService');
```

Each service now only focuses on its own concern — building the endpoint URL, processing the response body, and domain-specific validation.
