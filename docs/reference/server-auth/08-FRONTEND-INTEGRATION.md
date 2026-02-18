# Frontend Integration

## Overview

With server-side sessions the frontend is dramatically simplified. There is no MSAL.js, no token management, no token storage—just standard fetch calls with `credentials: "include"`. The browser's httpOnly `sid` cookie is sent automatically on every request.

## Installation

No auth libraries needed in the frontend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Application                       │  │
│  │                                                            │  │
│  │  - No tokens in JavaScript                                 │  │
│  │  - No MSAL.js                                              │  │
│  │  - fetch('/api/...') with credentials: 'include'           │  │
│  │  - Cookie sent automatically                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  httpOnly Cookie (automatic)
                              ▼ Vite proxy (:5173 → :4111)
                    ┌─────────────────┐
                    │ Mastra Server  │
                    │ (:4111)        │
                    └─────────────────┘
```

## API Client

### File: `src/app/lib/api.ts`

```typescript
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
    throw new Error(error.error ?? `HTTP ${response.status}`)
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
```

## React Hooks

### File: `src/app/hooks/useAuth.ts`

```typescript
import { useState, useEffect, useCallback } from "react"
import type { AuthContext, User } from "../lib/auth"

export function useAuth(): AuthContext {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user?: User }) => {
        setUser(data.authenticated ? (data.user ?? null) : null)
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(() => {
    window.location.href = "/auth/login"
  }, [])

  const logout = useCallback(async () => {
    try {
      const data = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      }).then((res) => res.json() as Promise<{ logoutUrl?: string }>)
      window.location.href = data.logoutUrl ?? "/"
    } catch {
      window.location.href = "/"
    }
    setUser(null)
  }, [])

  return {
    isAuthenticated: user !== null,
    isLoading,
    user,
    login,
    logout,
  }
}
```

The `useAuth` hook:

- Calls `GET /auth/me` on mount to hydrate auth state
- `login()` is synchronous — redirects to `/auth/login` (Vite proxies to Mastra)
- `logout()` POSTs to `/auth/logout`, then redirects to the Microsoft logout URL returned in the response

### File: `src/hooks/useCapabilities.ts`

```typescript
import { useState, useEffect } from "react"
import { get } from "../lib/api"

interface Capabilities {
  agents: string[]
  tools: string[]
  workflows: string[]
  groups: string[]
  user: {
    name: string
    email: string
    id: string
  }
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  async function fetchCapabilities() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await get<Capabilities>("/api/my-capabilities")
      setCapabilities(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCapabilities()
  }, [])

  return { capabilities, isLoading, error, refetch: fetchCapabilities }
}
```

### File: `src/hooks/useChat.ts`

```typescript
import { useState, useCallback } from "react"
import { streamPost } from "../lib/api"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content }])
    setIsLoading(true)

    try {
      let assistantMessage = ""

      // Stream the response
      for await (const chunk of streamPost("/api/agents/orchestrator/stream", {
        messages: [{ role: "user", content }],
      })) {
        // Parse SSE chunks
        const lines = chunk.split("\n")
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "text-delta") {
                assistantMessage += data.text

                // Update message in real-time
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1

                  if (updated[lastIdx]?.role === "assistant") {
                    updated[lastIdx] = {
                      role: "assistant",
                      content: assistantMessage,
                    }
                  } else {
                    updated.push({
                      role: "assistant",
                      content: assistantMessage,
                    })
                  }

                  return updated
                })
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, an error occurred. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isLoading, sendMessage, clearMessages }
}
```

## React Components

### File: `src/App.tsx`

```typescript
import { useAuth } from './hooks/useAuth';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />;
}
```

### File: `src/components/LoginPage.tsx`

```typescript
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';

export function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">
          Mastra Docs Bot
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            Authentication failed: {error}
          </div>
        )}

        <p className="text-gray-600 text-center mb-8">
          Sign in with your organization account to continue.
        </p>

        <button
          onClick={login}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg
                     hover:bg-blue-700 transition-colors font-medium"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
```

### File: `src/components/AuthenticatedApp.tsx`

```typescript
import { useAuth } from '../hooks/useAuth';
import { useCapabilities } from '../hooks/useCapabilities';
import { Chat } from './Chat';

export function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const { capabilities, isLoading } = useCapabilities();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold">Mastra Docs Bot</h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.name || user?.email}
            </span>

            {!isLoading && capabilities && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                {capabilities.groups.join(', ') || 'No groups'}
              </span>
            )}

            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-4">
        <Chat />
      </main>
    </div>
  );
}
```

### File: `src/components/Chat.tsx`

```typescript
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';

export function Chat() {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    sendMessage(input.trim());
    setInput('');
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation with the assistant.
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="bg-gray-100 p-4 rounded-lg mr-auto max-w-[80%]">
            <div className="text-xs text-gray-500 mb-1">Assistant</div>
            <div className="animate-pulse">Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

## Vite Configuration

### File: `vite.config.ts`

```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Both /api and /auth route to the Mastra server
      "/api": {
        target: "http://localhost:4111",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:4111",
        changeOrigin: true,
      },
    },
  },
})
```

> Both `/api` and `/auth` are proxied to the Mastra server (:4111). There is no intermediate BFF process.

## Environment Variables

### Frontend (`.env`)

```bash
# No sensitive variables needed in the frontend.
# All auth is handled server-side on the Mastra server.
```

All Azure credentials live in the Mastra server's environment only.

## Comparison: Before vs After

### Before (Client-Side MSAL)

```typescript
// 50+ lines of MSAL configuration
import { PublicClientApplication, Configuration } from "@azure/msal-browser"
import { MsalProvider, useMsal, useIsAuthenticated } from "@azure/msal-react"

const msalConfig: Configuration = {
  /* ... */
}
const msalInstance = new PublicClientApplication(msalConfig)

// Token acquisition with error handling
async function getAccessToken() {
  try {
    const response = await msalInstance.acquireTokenSilent({
      /* ... */
    })
    return response.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.loginRedirect({
        /* ... */
      })
    }
  }
}

// Every API call needs the token
const response = await fetch("/api/endpoint", {
  headers: {
    Authorization: `Bearer ${await getAccessToken()}`,
  },
})
```

### After (server-side sessions)

```typescript
// Just fetch with credentials
const response = await fetch("/api/endpoint", {
  credentials: "include",
})
```

## Security Notes

1. **No tokens in JavaScript**: XSS cannot steal tokens
2. **Automatic cookie handling**: Browser manages session cookie
3. **401 handling**: Redirect to login on auth failure
4. **Same-origin requests**: Cookies sent automatically

## Error Handling

The API client redirects to `/auth/login` on 401 errors. For other errors, components should display user-friendly messages:

```typescript
try {
  await sendMessage(content)
} catch (error) {
  // Show error toast or inline message
  toast.error("Failed to send message. Please try again.")
}
```
