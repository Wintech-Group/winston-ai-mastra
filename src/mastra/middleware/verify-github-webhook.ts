import { Webhooks, type EmitterWebhookEventName } from "@octokit/webhooks"
import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
})

export { webhooks }

// Just signature verification
export const verifyGitHubWebhook = createMiddleware(async (c, next) => {
  const signature = c.req.header("x-hub-signature-256")
  const event = c.req.header("x-github-event")
  const id = c.req.header("x-github-delivery")

  if (!signature || !event || !id) {
    throw new HTTPException(401, { message: "Missing required headers" })
  }

  const rawBody = await c.req.text()

  // Use octokit's verify (handles timing-safe comparison internally)
  const isValid = await webhooks.verify(rawBody, signature)
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid signature" })
  }

  // Store for handler
  c.set("webhookPayload", JSON.parse(rawBody))
  c.set("webhookEvent", event as EmitterWebhookEventName)
  c.set("webhookDeliveryId", id)

  await next()
})
