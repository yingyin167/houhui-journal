import path from 'node:path'

const isProduction = process.env.NODE_ENV === 'production'

export const serverConfig = {
  port: Number(process.env.PORT || (isProduction ? 8080 : 8787)),
  host: process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
  databasePath: process.env.DATABASE_PATH || path.resolve('data/houhui.sqlite'),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  webOrigin: process.env.WEB_ORIGIN || 'http://127.0.0.1:5177',
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || '',
  isProduction,
}

export function assertProductionConfig() {
  if (!serverConfig.isProduction) return
  if (!serverConfig.adminPassword || serverConfig.adminPassword.length < 16) {
    throw new Error('Production requires ADMIN_PASSWORD with at least 16 characters.')
  }
  if (!serverConfig.sessionSecret || serverConfig.sessionSecret.length < 32) {
    throw new Error('Production requires SESSION_SECRET with at least 32 characters.')
  }
}
