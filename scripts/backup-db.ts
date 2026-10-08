import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execFileAsync = promisify(execFile)

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 30

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

async function runPgDump(): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não está definida.')
  }

  const file = path.join(BACKUP_DIR, `menufacil-${timestamp()}.sql.gz`)

  const isWindows = process.platform === 'win32'
  const pgDump = isWindows ? 'pg_dump.exe' : 'pg_dump'

  await execFileAsync(pgDump, ['--no-owner', '--no-privileges', databaseUrl], {
    maxBuffer: 1024 * 1024 * 256,
    ...(isWindows ? { shell: true } : {}),
  }).then(async ({ stdout }) => {
    const zlib = await import('node:zlib')
    fs.writeFileSync(file, zlib.gzipSync(Buffer.from(stdout)))
  })

  return file
}

function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    if (!name.endsWith('.sql.gz')) continue
    const full = path.join(BACKUP_DIR, name)
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full)
      console.log(`[Backup] Removido backup expirado: ${name}`)
    }
  }
}

async function main() {
  console.log('\n💾 Iniciando backup do banco de dados...')

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  try {
    const file = await runPgDump()
    const size = fs.statSync(file).size
    console.log(`✅ Backup criado: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`)
    pruneOldBackups()
    console.log(`📂 Retenção: ${RETENTION_DAYS} dias em ${BACKUP_DIR}`)
  } catch (err: any) {
    console.error('❌ Erro ao criar backup:', err.message)
    if (/not found|não reconhecido|ENOENT/i.test(err.message)) {
      console.error('   pg_dump não encontrado. Instale o PostgreSQL client tools:')
      console.error('   https://www.postgresql.org/download/')
    }
    process.exit(1)
  }
}

main()