# MonitorPro: Real Backend & Monitoring Engine — Design Spec

**Date:** 2026-07-10
**Status:** Approved

## Goal

Convert MonitorPro from a frontend-only mock app (localStorage, simulated incidents) into a real, functioning monitoring product: real accounts, real persistence, and a real HTTP-ping monitoring engine that detects outages and notifies by email — deployed on the user's existing Hostinger VPS.

This is scoped as the **first** of several planned sub-projects. Slack/SMS/Telegram notifications and any UI redesign are explicitly out of scope for this pass.

## Non-goals

- No UI/visual redesign — the existing React components and Tailwind styling are preserved as-is.
- No Slack/SMS/Telegram notification delivery (fields remain in the schema for future use, but are not wired up).
- No multi-workspace/team features beyond what already exists in `WorkspaceSettings`.
- No migration off Vite — the frontend build tooling is unchanged.

## Architecture

```
┌─────────────────┐     HTTPS      ┌──────────────────────────┐
│  Frontend (Vite)│◄──────────────►│  API Express (Node/TS)   │
│  React (as-is)  │                │  + Monitoring worker      │
└─────────────────┘                │  (node-cron, same process)│
                                    └───────────┬──────────────┘
                                                │
                                          ┌──────▼──────┐
                                          │  PostgreSQL  │
                                          └──────────────┘
```

- Single Node/Express process hosts both the REST API and the `node-cron` monitoring worker (confirmed: worker runs in-process, not a separate service).
- Deployed on the user's Hostinger VPS: Nginx as reverse proxy + TLS via Certbot, PM2 to keep the Node process alive, Postgres running as a system service.
- The existing frontend components (`App.tsx`, `src/components/*`) keep their current UI. Only the data layer changes: calls that today go through `loadData`/`saveData` (`src/data.ts`, backed by `localStorage`) are replaced with `fetch` calls to the new API.

## Data model (PostgreSQL)

Derived from `src/types.ts`, normalized where the mock data was flat/embedded.

- **`users`**: `id`, `email` (unique), `password_hash`, `username`, `avatar_url`, `role`, `created_at`
- **`websites`**: `id`, `user_id` (FK), `name`, `url`, `status`, `check_interval`, `locations` (json), `tags` (json), `ssl_status`, `ssl_expiry_days`, `created_at`
- **`response_time_checks`**: `id`, `website_id` (FK), `timestamp`, `value_ms` — replaces the embedded `responseTimeHistory` array; a real historical table instead of a fixed 24-point mock array.
- **`incidents`**: `id`, `website_id` (FK), `title`, `severity`, `status`, `description`, `created_at`, `acknowledged_at`, `resolved_at`
- **`notification_settings`**: `id`, `user_id` (FK), `email_enabled`, `email_address`, `slack_enabled`, `slack_webhook`, `sms_enabled`, `sms_phone`, `telegram_enabled`, `telegram_chat_id`, `threshold_response_time`, `threshold_ssl_days`
- **`workspace_settings`**: `id`, `user_id` (FK), `company_name`, `plan`, `timezone`, `api_key`

`uptime24h` / `uptime30d` are **not** stored as static fields — they are computed on read from `response_time_checks` (percentage of checks within the window that were not `down`).

## Authentication

- `POST /api/auth/register` — email + password, `bcrypt` hash, creates `users` row plus default `workspace_settings` and `notification_settings`.
- `POST /api/auth/login` — validates credentials, issues a JWT in an `httpOnly` + `secure` cookie (not localStorage, to avoid XSS token theft).
- `POST /api/auth/logout` — clears the cookie.
- `requireAuth` middleware protects all `/api/websites`, `/api/incidents`, `/api/notifications`, `/api/settings` routes. Every query is scoped by `user_id` — users only ever see their own data.
- `LoginView.tsx` is updated to call this real API instead of the current `setTimeout`-simulated login.

## Monitoring engine

- `node-cron` runs a scheduler tick every minute. For each `website` whose `check_interval` has elapsed since its last check, the worker performs a real HTTP request to `website.url`, measuring response time and status code.
- Each check result is written to `response_time_checks`.
- **Failure** (timeout, connection refused, 5xx) → worker retries once (to avoid false positives from transient network blips on the worker's own side) before: creating a new `critical` incident (if none is already active for that site) and setting `website.status = 'down'`.
- **Elevated latency** beyond `notification_settings.threshold_response_time` → `website.status = 'degraded'`, a `warning` incident is created.
- **Recovery** — when a subsequent check on a `down`/`degraded` site succeeds within normal thresholds: the worker finds that site's currently-active incident and sets `status: 'resolved'`, `resolved_at: now()`, computes `duration` from `created_at` to `resolved_at`, and sets `website.status = 'up'`. This is the same transition `handleResolveIncident` performs manually today — now triggered by the monitor itself rather than a user click, because the site genuinely recovered.
- The existing "playground" simulation controls (`handleInjectIncident`, `handleTriggerPingTest`, and their UI triggers in `IncidentsView`/`DetailsView`) are **removed** — they no longer serve a purpose once incidents are real, and keeping them risks mixing simulated and real data.

## Notifications (email only, this pass)

- On new incident creation (down or degraded): send an email to `notification_settings.email_address` via **Nodemailer** over SMTP (provider — user's Hostinger mailbox or a transactional provider like Resend/Brevo — to be decided at implementation time).
- On automatic resolution: send a confirmation email.
- Respects the existing `email: true/false` toggle already present in `NotificationsView`.
- Slack/SMS/Telegram fields remain in the schema (already modeled) but are not wired to any delivery mechanism in this pass — explicitly deferred.

## Error handling

- Network-level failures on the worker's own check attempt are retried once before being treated as a real incident, to reduce false positives from transient blips.
- All API routes validate input (valid email format, valid URL format, etc.) before touching the database.
- Auth failures return generic 401s (no user enumeration via distinct "wrong email" vs "wrong password" messages).

## Testing

- Unit tests (Vitest or Jest) for:
  - Monitoring engine state transitions (up → degraded → down → resolved) and uptime computation from `response_time_checks`.
  - Auth endpoints (register/login/logout, including duplicate-email and bad-credential cases).
- No end-to-end/browser test suite is introduced in this pass.

## Deployment

- Hostinger VPS: Postgres as a system service, Nginx reverse proxy with Certbot-issued TLS, PM2 managing the Node process (API + worker) for restart-on-crash and boot persistence.
- Environment variables (DB credentials, JWT secret, SMTP credentials) via `.env`, never committed.

## Open questions for implementation time

- Exact SMTP provider (Hostinger mailbox vs. Resend/Brevo) — deferred to implementation.
- Whether `response_time_checks` needs a retention/pruning policy (e.g., downsample after 30 days) — not addressed in this pass; can grow unbounded initially and be revisited if it becomes a storage concern.
