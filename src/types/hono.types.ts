import type {
  EmitterWebhookEvent,
  EmitterWebhookEventName,
} from "@octokit/webhooks"

declare module "hono" {
  interface ContextVariableMap {
    webhookPayload: EmitterWebhookEvent["payload"]
    webhookEvent: EmitterWebhookEventName
    webhookDeliveryId: string
  }
}
