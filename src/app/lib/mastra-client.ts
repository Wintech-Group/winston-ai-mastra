const API_BASE = "/api"

export async function sendMessage(
  agentId: string,
  threadId: string,
  message: string,
) {
  const res = await fetch(`${API_BASE}/agents/${agentId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      threadId,
    }),
  })
  if (!res.ok) throw new Error(`Agent error: ${res.status}`)
  return res.json()
}

export async function streamMessage(
  agentId: string,
  threadId: string,
  message: string,
) {
  const res = await fetch(`${API_BASE}/agents/${agentId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      threadId,
    }),
  })
  if (!res.ok) throw new Error(`Agent error: ${res.status}`)
  return res.body
}
