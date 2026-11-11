import { createServer } from 'node:http'
import { createApp } from './app'
import { serverConfig } from './config'
import { JournalDatabase } from './database'

const database = new JournalDatabase()
const app = createApp(database, { serveFrontend: serverConfig.isProduction })
const server = createServer(app)

server.listen(serverConfig.port, serverConfig.host, () => {
  console.log(`后会有期刊 API listening on http://${serverConfig.host}:${serverConfig.port}`)
})

function shutdown() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
