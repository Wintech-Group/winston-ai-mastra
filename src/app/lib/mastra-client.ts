import { InteractionRequiredAuthError } from "@azure/msal-browser"
import { loginRequest, msalInstance } from "./msal-config"

const API_BASE = "/api"

async function getAccessToken(): Promise<string> {
  const account = msalInstance.getActiveAccount()

  if (!account) {
    await msalInstance.loginRedirect(loginRequest)
    throw new Error("Redirecting to login")
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    })

    return response.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.loginRedirect(loginRequest)
      throw new Error("Redirecting to login")
    }

    throw error
  }
}

export async function sendMessage(
  agentId: string,
  threadId: string,
  message: string,
) {
  const accessToken = await getAccessToken()

  const res = await fetch(`${API_BASE}/agents/${agentId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
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
  const accessToken = await getAccessToken()

  const res = await fetch(`${API_BASE}/agents/${agentId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      threadId,
    }),
  })
  if (!res.ok) throw new Error(`Agent error: ${res.status}`)
  return res.body
}
