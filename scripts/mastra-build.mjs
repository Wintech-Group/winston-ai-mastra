import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const cleaned = line.startsWith("export ") ? line.slice(7) : line
    const eqIndex = cleaned.indexOf("=")
    if (eqIndex <= 0) continue
    const key = cleaned.slice(0, eqIndex).trim()
    let value = cleaned.slice(eqIndex + 1).trim()
    if (!key || process.env[key] !== undefined) continue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadDotEnv(resolve(process.cwd(), ".env"))

if (!process.env.GITHUB_PAT) {
  console.warn(
    "GITHUB_PAT is not set. Private GitHub Packages may fail to install during build.",
  )
}

const result = spawnSync("mastra", ["build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
