# Project Repository

This is the initial README file for the project.

## Backend middleware (MVP)

The Express backend includes:
- **Request logging**: lightweight middleware that logs `method`, `path`, `status`, and request `duration` (ms). It intentionally avoids logging headers/query/body to reduce risk of secret leakage.
- **Rate limiting**: simple in-memory per-IP limiter (**100 requests / 15 minutes**) returning standardized JSON errors via the centralized error handler.
  - `/api/health` is explicitly **excluded** from rate limiting.
  - Note: in-memory limits reset on restart and are not shared across instances.