import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const source = path.resolve(process.env.DATABASE_PATH || 'data/houhui.sqlite')
if (!fs.existsSync(source)) {
  throw new Error(`Database does not exist: ${source}`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const target = path.resolve(process.argv[2] || path.join('backups', `houhui-${stamp}.sqlite`))
if (path.resolve(source) === target) {
  throw new Error('Backup target must be different from the source database.')
}
if (fs.existsSync(target)) {
  throw new Error(`Backup target already exists: ${target}`)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
const escapedTarget = target.replaceAll("'", "''")
const database = new DatabaseSync(source)
try {
  database.exec(`VACUUM INTO '${escapedTarget}'`)
} finally {
  database.close()
}
console.log(`Database backup created: ${target}`)
