import { registerApiRoute } from "@mastra/core/server"
import {
  verifyGitHubWebhook,
  webhooks,
} from "../../middleware/verify-github-webhook"
import { type EmitterWebhookEvent } from "@octokit/webhooks"
import { handlePushEvent } from "./handlers/push-handler"

// Register event handlers with full type safety
webhooks.on("push", async (event) => {
  const { id, payload } = event
  console.log(`[${id}] Push to ${payload.repository.full_name}`)
  // Your push handler: sync to SharePoint, generate PDF, update index

  try {
    await handlePushEvent(event)
  } catch (error) {
    console.error(`[${id}] Failed to handle push event:`, error)
    throw error
  }
})

webhooks.on("pull_request.opened", async ({ id, payload }) => {
  console.log(`[${id}] PR #${payload.pull_request.number} opened`)
  // Validate schema, identify domains, add approval table
})

webhooks.on("pull_request.synchronize", async ({ id, payload }) => {
  console.log(`[${id}] PR #${payload.pull_request.number} updated`)
  // Re-validate, update approval table if needed
})

webhooks.on("issues.opened", async ({ id, payload }) => {
  console.log(`[${id}] Issue #${payload.issue.number} opened`)
  // Track as suggestion, notify policy owner
})

webhooks.on("issue_comment.created", async ({ id, payload }) => {
  console.log(`[${id}] Comment on #${payload.issue.number}`)
  // Check for approval commands
})

webhooks.onError((error) => {
  console.error("Webhook error:", error)
})

export const githubWebhookRoute = registerApiRoute("/webhooks/github", {
  method: "POST",
  requiresAuth: false,
  middleware: [verifyGitHubWebhook],
  handler: async (c) => {
    const payload = c.get("webhookPayload")
    const name = c.get("webhookEvent")
    const id = c.get("webhookDeliveryId")

    console.log(`Received GitHub event: ${name} (Delivery ID: ${id})`)

    // Dispatch to registered handlers
    // Type assertion needed: name↔payload correlation is proven at runtime by GitHub
    await webhooks.receive({
      id,
      name,
      payload,
    } as EmitterWebhookEvent)

    return c.json({ received: true })
  },
})
