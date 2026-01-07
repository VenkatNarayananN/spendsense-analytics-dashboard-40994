# Project Repository

This is the initial README file for the project.

## Environment variables

This repository uses multiple containers (frontend, backend, and database tooling), each with its own environment variables. For a complete list of required and optional variables, their purpose, and the exact code locations where they are read, see `kavia-docs/ENVIRONMENT.md`.

The backend specifically uses environment variables for:
- binding the HTTP server (host/port),
- configuring Supabase JWT verification for `/api/*` routes,
- configuring the Open Exchange Rates API key for `/api/fx/latest`,
- configuring PostgreSQL connectivity (Supabase Postgres preferred, local Postgres fallback).

### Backend database environment variables

The backend resolves a single effective PostgreSQL target using the following priority:

1) **Supabase Postgres**
- Preferred:
  - `SUPABASE_DB_URL` (full Postgres connection string)
- Otherwise discrete fields:
  - `SUPABASE_DB_HOST`
  - `SUPABASE_DB_PORT`
  - `SUPABASE_DB_NAME`
  - `SUPABASE_DB_USER`
  - `SUPABASE_DB_PASSWORD`

2) **Local Postgres**
- Preferred:
  - `POSTGRES_URL` (full Postgres connection string)
- Otherwise discrete fields:
  - `POSTGRES_HOST`
  - `POSTGRES_PORT`
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`

SSL behavior:
- Hosted DBs (Supabase): SSL defaults **on**.
- Local DBs: SSL defaults **off** unless explicitly enabled.
- Supported toggles:
  - `PGSSLMODE=require` (forces SSL on)
  - `SSL=true` (forces SSL on)
  - `POSTGRES_SSL=true` (enables SSL for local)

Examples:

Supabase via URL:
- `SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE`
- `PGSSLMODE=require`

Supabase via discrete fields:
- `SUPABASE_DB_HOST=HOST`
- `SUPABASE_DB_PORT=5432`
- `SUPABASE_DB_NAME=DATABASE`
- `SUPABASE_DB_USER=USER`
- `SUPABASE_DB_PASSWORD=PASSWORD`
- `PGSSLMODE=require`

Local Postgres via URL:
- `POSTGRES_URL=postgresql://USER:PASSWORD@localhost:5432/mydb`

Local Postgres via discrete fields:
- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=mydb`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- `POSTGRES_SSL=false`

## Backend middleware (MVP)

The Express backend includes:
- **Request logging**: lightweight middleware that logs `method`, `path`, `status`, and request `duration` (ms). It intentionally avoids logging headers/query/body to reduce risk of secret leakage.
- **Rate limiting**: simple in-memory per-IP limiter (**100 requests / 15 minutes**) returning standardized JSON errors via the centralized error handler.
  - `/api/health` is explicitly **excluded** from rate limiting.
  - Note: in-memory limits reset on restart and are not shared across instances.