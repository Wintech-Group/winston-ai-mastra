import { deleteExpiredSessions } from "../src/mastra/auth/session-store"

async function main() {
  const deleted = await deleteExpiredSessions()
  console.log(`Deleted ${deleted} expired sessions`)
}

main().catch(console.error)
