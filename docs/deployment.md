# Production Deployment

## What the server provides

In production, one Node process provides both:

- The built frontend from `dist/`
- The backend API under `/api/`

The public site and API therefore share one origin. Visitors do not need to know the API port.

## Requirements

- Node.js 22 or newer
- A host that can run a long-lived Node process
- Persistent storage for `data/houhui.sqlite`
- HTTPS before accepting real submissions

The current database uses SQLite. Do not deploy it on temporary or non-persistent storage.

## First deployment

1. Copy the project to the server.
2. Copy `.env.example` to `.env`.
3. Replace `ADMIN_PASSWORD` and `SESSION_SECRET` with real secrets. Do not commit `.env`.
4. Set `WEB_ORIGIN` to the final HTTPS origin.
5. Install dependencies:

```powershell
npm install
```

6. Build the frontend:

```powershell
npm run build
```

7. Start the production process:

```powershell
npm run start:production
```

The service listens on `PORT` and serves the site at `/`. The health check is `/health`.

If `NOTIFICATION_WEBHOOK_URL` is set, each new submission also sends a small
`submission.created` JSON event to that URL. The event does not include the
author's private email or submission body.

Authenticated administrators can review operation history through
`/api/admin/audit-logs`. The log records successful admin actions and public
submission creation events without storing submission bodies.

## Before accepting submissions

- Open the public site and submit a test work.
- Open `/admin` and approve the test work.
- Confirm the approved work is publicly visible.
- Add and moderate a test comment.
- Confirm the database file is on persistent storage.
- Create and restore a database backup.
- Put the service behind HTTPS.

## Backup

Use the SQLite-aware backup command:

```powershell
npm run backup:database
```

To choose a specific target path:

```powershell
npm run backup:database -- backups/houhui-before-migration.sqlite
```

Keep backups outside the application directory and test a restore before launch.

## Current limitations

- Notification delivery is optional and depends on the configured webhook.
- There is no built-in SMTP provider integration yet.
- Rate limits are in-process and should be paired with a reverse proxy or WAF for a larger public launch.
- Private email fields are stored in SQLite and are not included in public API responses.
- Production deployment still needs an operational owner for moderation, backups, and abuse handling.
