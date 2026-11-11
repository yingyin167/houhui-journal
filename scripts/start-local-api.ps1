$ErrorActionPreference = 'Stop'
if (-not $env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD = 'local-admin-password-123456' }
if (-not $env:SESSION_SECRET) { $env:SESSION_SECRET = 'local-session-secret-please-change-before-production-123456' }
node --import tsx/esm server/index.ts
