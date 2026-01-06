# Project Repository

This is the initial README file for the project.

## Environment variables

This repository uses multiple containers (frontend, backend, and database tooling), each with its own environment variables. For a complete list of required and optional variables, their purpose, and the exact code locations where they are read, see `kavia-docs/ENVIRONMENT.md`.

The backend specifically uses environment variables for:
- binding the HTTP server (host/port),
- configuring Supabase JWT verification for `/api/*` routes,
- configuring the Open Exchange Rates API key for `/api/fx/latest`.

## Backend middleware (MVP)

The Express backend includes:
- **Request logging**: lightweight middleware that logs `method`, `path`, `status`, and request `duration` (ms). It intentionally avoids logging headers/query/body to reduce risk of secret leakage.
- **Rate limiting**: simple in-memory per-IP limiter (**100 requests / 15 minutes**) returning standardized JSON errors via the centralized error handler.
  - `/api/health` is explicitly **excluded** from rate limiting.
  - Note: in-memory limits reset on restart and are not shared across instances.