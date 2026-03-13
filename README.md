# Mini AI Toolkit

A full-stack AI content generation platform supporting both image and text generation with real-time updates, job management, and a modern UI.

## Quick Start

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# Clone the repo
git clone https://github.com/beqa200/ai-toolkit-infra.git
cd ai-toolkit-infra

# Copy environment file
cp .env.example .env

# Start everything
docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:4000

---

## Tech Stack & Rationale

### Frontend

| Technology           | Why                                               |
| -------------------- | ------------------------------------------------- |
| **Next.js 16**       | App Router, React Server Components, excellent DX |
| **React 19**         | Latest features, improved performance             |
| **Tailwind CSS 4**   | Rapid UI development, consistent design system    |
| **Socket.IO Client** | Real-time job status updates without polling      |

### Backend

| Technology     | Why                                                                     |
| -------------- | ----------------------------------------------------------------------- |
| **Express.js** | Lightweight, flexible, great for REST APIs                              |
| **TypeScript** | Type safety, better IDE support, fewer runtime errors                   |
| **Prisma**     | Type-safe ORM, excellent migration tooling, works great with TypeScript |
| **PostgreSQL** | Reliable, feature-rich, production-ready database                       |
| **Socket.IO**  | WebSocket abstraction with fallbacks, room-based subscriptions          |
| **Winston**    | Structured logging with multiple transports (console, file)             |

### Infrastructure

| Technology                 | Why                                                         |
| -------------------------- | ----------------------------------------------------------- |
| **Docker Compose**         | One-command setup, consistent environments, easy deployment |
| **Multi-stage Dockerfile** | Smaller images, faster builds, security best practices      |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│                   Next.js React Frontend                     │
└────────────────────┬────────────────────┬───────────────────┘
                     │ REST API           │ WebSocket
                     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express.js Backend                         │
│                                                              │
│   POST /api/generations     → Create job                     │
│   GET  /api/generations     → List jobs (history)            │
│   GET  /api/generations/:id → Get job details                │
│   POST /api/generations/:id/cancel → Cancel job              │
│   POST /api/generations/:id/retry  → Retry failed job        │
│                                                              │
│   Socket.IO: job:update, jobs:changed events                 │
└────────────────────┬────────────────────┬───────────────────┘
                     │                    │
                     ▼                    ▼
┌────────────────────────┐    ┌───────────────────────────────┐
│   PostgreSQL (Prisma)   │    │      Pollinations AI API      │
│   - generation_jobs     │    │   - Text generation           │
│   - status tracking     │    │   - Image generation          │
│   - result storage      │    │   - Prompt enhancement        │
└────────────────────────┘    └───────────────────────────────┘
```

### Job Lifecycle

```
PENDING → GENERATING → COMPLETED
                    ↘ FAILED
                    ↘ CANCELLED
```

---

## Features

### Core Requirements

- **Image Generation** — Generate images from text prompts
- **Text Generation** — Generate text content from prompts
- **Async Processing** — Jobs run in background, UI updates in real-time
- **Gallery View** — Browse all completed generations
- **Generation History** — View all jobs with status and timestamps

### Bonus Features

| Feature                         | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| **AI Prompt Enhancement**       | Automatically improves user prompts before generation using AI |
| **Real-time WebSocket Updates** | Instant status changes via Socket.IO (no polling)              |
| **Job Cancellation**            | Cancel pending/generating jobs with abort controller support   |
| **Job Retry**                   | Retry failed jobs with one click                               |
| **Structured Logging**          | Winston logger with file rotation and log levels               |
| **Custom Error Hierarchy**      | `ValidationError`, `NotFoundError`, `ExternalServiceError`     |
| **Centralized Error Handling**  | Single middleware handles all errors consistently              |
| **Docker Compose Setup**        | One-command deployment with auto-migrations                    |
| **Image Lightbox**              | Click to expand generated images                               |
| **Keyboard Shortcuts**          | `⌘/Ctrl + Enter` to submit                                     |

---

## AI Integration

### Real AI — Pollinations API

This project uses **real AI** via the [Pollinations API](https://pollinations.ai/), a free AI generation service.

**Why Pollinations?**

- Free tier available (no credit card required)
- Simple REST API
- Supports both text and image generation
- Fast response times

**Three AI calls per job:**

1. **Prompt Enhancement** — Improves the user's prompt with artistic details
2. **Image/Text Generation** — Creates the actual content

**Example prompt enhancement:**

```
Input:  "a cat"
Output: "A majestic tabby cat with emerald eyes, soft golden
         afternoon light, bokeh background, photorealistic,
         8k ultra detailed"
```

---

## Project Structure

```
ai-toolkit-artlis/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic (AI calls)
│   │   ├── repositories/       # Database operations
│   │   ├── middleware/         # Error handler, request logger
│   │   ├── lib/                # Shared utilities
│   │   └── server.ts           # Express app entry point
│   ├── Dockerfile
│   └── docker-entrypoint.sh    # Auto-runs migrations
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # API client, socket setup
│   │   └── types/              # TypeScript types
│   └── Dockerfile
│
└── infra/
    ├── docker-compose.yml      # Orchestrates all services
    ├── .env.example            # Environment template
    └── README.md               # Setup instructions
```

---

## What I'd Improve With More Time

### Performance

- **Redis caching** — Cache completed jobs, reduce DB queries
- **CDN for images** — Serve generated images from edge locations
- **Connection pooling** — Optimize database connections under load

### Features

- **User authentication** — Personal galleries, job ownership
- **Job queue with priorities** — BullMQ or similar for better job management
- **Rate limiting** — Prevent API abuse
- **Image variations** — Generate multiple options per prompt
- **Download button** — Save images directly
- **Share functionality** — Public links for generations

### Developer Experience

- **E2E tests** — Playwright tests for critical flows
- **API documentation** — OpenAPI/Swagger spec
- **CI/CD pipeline** — Automated testing and deployment
- **Monitoring** — Prometheus metrics, Grafana dashboards

### Code Quality

- **Input sanitization** — More robust prompt validation
- **Request validation** — Zod schemas for all endpoints
- **Database indexes** — Optimize common queries
- **Graceful shutdown** — Proper cleanup on container stop

---

## Environment Variables

| Variable                | Description                        | Example                       |
| ----------------------- | ---------------------------------- | ----------------------------- |
| `PORT`                  | Backend server port                | `4000`                        |
| `DATABASE_URL`          | PostgreSQL connection string       | `postgresql://...`            |
| `POLLINATIONS_BASE_URL` | AI API base URL                    | `https://gen.pollinations.ai` |
| `POLLINATIONS_API_KEY`  | API key (optional for basic usage) | `sk_...`                      |
| `DB_USER`               | PostgreSQL username                | `postgres`                    |
| `DB_PASSWORD`           | PostgreSQL password                | `your-password`               |
| `DB_NAME`               | PostgreSQL database name           | `ai_toolkit`                  |

---

## Development

### Without Docker

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Configure DATABASE_URL
npx prisma db push
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Useful Commands

```bash
# View logs
docker compose logs -f backend

# Rebuild single service
docker compose up --build backend

# Reset database
docker compose down -v
docker compose up --build

# Access database
docker exec -it postgres-db psql -U postgres -d ai_toolkit
```

---
