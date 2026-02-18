const API_BASE = "/api"

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (response.status === 401) {
    window.location.href = "/auth/login"
    throw new Error("Unauthorized")
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }))
    throw new Error(
      (error as { error?: string }).error ?? `HTTP ${response.status}`,
    )
  }

  return response.json() as Promise<T>
}

export async function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" })
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function sendMessage(
  agentId: string,
  threadId: string,
  message: string,
) {
  return post(`${API_BASE}/agents/${agentId}/generate`, {
    messages: [{ role: "user", content: message }],
    threadId,
  })
}

export async function streamMessage(
  agentId: string,
  threadId: string,
  message: string,
) {
  const response = await fetch(`${API_BASE}/agents/${agentId}/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      threadId,
    }),
  })

  if (response.status === 401) {
    window.location.href = "/auth/login"
    throw new Error("Unauthorized")
  }

  if (!response.ok) throw new Error(`Agent error: ${response.status}`)
  return response.body
}
