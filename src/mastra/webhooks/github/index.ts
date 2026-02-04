import { registerApiRoute } from '@mastra/core/server';

/**
 * GitHub webhook endpoint handler
 * Receives webhook events from GitHub (push, pull_request, issues, etc.)
 */
export const githubWebhookRoute = registerApiRoute('/webhooks/github', {
  method: 'POST',
  requiresAuth: false, // Webhooks need to be publicly accessible
  handler: async (c) => {
    // Get the raw request
    const body = await c.req.json();
    const headers = Object.fromEntries(c.req.raw.headers.entries());

    // Log the webhook event for inspection
    console.log('=== GitHub Webhook Received ===');
    console.log('Event Type:', headers['x-github-event']);
    console.log('Delivery ID:', headers['x-github-delivery']);
    console.log('Signature:', headers['x-hub-signature-256']);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Payload:', JSON.stringify(body, null, 2));
    console.log('================================');

    // TODO: Implement webhook handling logic:
    // 1. Verify webhook signature using GITHUB_WEBHOOK_SECRET
    // 2. Parse event type from X-GitHub-Event header
    // 3. Route to appropriate handler (push, pull_request, issues, etc.)

    return c.json({ received: true });
  },
});
