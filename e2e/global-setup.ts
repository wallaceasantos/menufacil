import { execSync } from 'child_process'

export default function globalSetup() {
  execSync('npx prisma db push --accept-data-loss --skip-generate', { stdio: 'inherit' })
  execSync('npx tsx scripts/seed-test.ts', { stdio: 'inherit' })
}