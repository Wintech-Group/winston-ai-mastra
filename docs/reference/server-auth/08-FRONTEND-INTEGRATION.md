# Frontend Integration

## Overview

With the BFF pattern, the frontend is dramatically simplified. There's no MSAL.js, no token management, no token storage—just standard fetch calls. Authentication state is managed via httpOnly cookies that the browser handles automatically.

## Installation

```bash
pnpm add @mastra/client-js
```

That's it. No auth libraries needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Application                       │  │
│  │                                                            │  │
│  │  - No tokens in JavaScript                                 │  │
│  │  - No MSAL.js                                              │  │
│  │  - Just fetch('/api/...') with credentials: 'include'     │  │
│  │  - Cookie sent automatically                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  httpOnly Cookie (automatic)
                              ▼
                    ┌─────────────────┐
                    │   BFF Server    │
                    └─────────────────┘
```

## API Client

### File: `src/lib/api.ts`

```typescript
/**
 * Simple fetch wrapper that includes credentials (cookies)
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include', // Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    // Redirect to login on auth failure
    window.location.href = '/auth/login';
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * GET request
 */
export async function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

/**
 * POST request
 */
export async function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Streaming fetch for agent responses
 */
export async function* streamPost(
  path: string,
  body: unknown
): AsyncGenerator<string> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (response.status === 401) {
    window.location.href = '/auth/login';
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
```

## React Hooks

### File: `src/hooks/useAuth.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../lib/api';

interface User {
  name?: string;
  email?: string;
  groups?: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: () => void;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Check auth status on mount
    get<{ authenticated: boolean; user?: User }>('/auth/me')
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user || null);
        }
      })
      .catch(() => {
        // Not authenticated
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);
  
  const login = useCallback(() => {
    // Redirect to BFF login endpoint
    window.location.href = '/auth/login';
  }, []);
  
  const logout = useCallback(async () => {
    try {
      const { logoutUrl } = await post<{ success: boolean; logoutUrl: string }>('/auth/logout');
      // Optionally redirect to Microsoft logout
      window.location.href = logoutUrl;
    } catch (error) {
      // Even if logout fails, redirect to login
      window.location.href = '/';
    }
  }, []);
  
  return {
    isAuthenticated: user !== null,
    isLoading,
    user,
    login,
    logout,
  };
}
```

### File: `src/hooks/useCapabilities.ts`

```typescript
import { useState, useEffect } from 'react';
import { get } from '../lib/api';

interface Capabilities {
  agents: string[];
  tools: string[];
  workflows: string[];
  groups: string[];
  user: {
    name: string;
    email: string;
    id: string;
  };
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  async function fetchCapabilities() {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await get<Capabilities>('/api/my-capabilities');
      setCapabilities(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }
  
  useEffect(() => {
    fetchCapabilities();
  }, []);
  
  return { capabilities, isLoading, error, refetch: fetchCapabilities };
}
```

### File: `src/hooks/useChat.ts`

```typescript
import { useState, useCallback } from 'react';
import { streamPost } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsLoading(true);
    
    try {
      let assistantMessage = '';
      
      // Stream the response
      for await (const chunk of streamPost('/api/agents/orchestrator/stream', {
        messages: [{ role: 'user', content }],
      })) {
        // Parse SSE chunks
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text-delta') {
                assistantMessage += data.text;
                
                // Update message in real-time
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  
                  if (updated[lastIdx]?.role === 'assistant') {
                    updated[lastIdx] = { role: 'assistant', content: assistantMessage };
                  } else {
                    updated.push({ role: 'assistant', content: assistantMessage });
                  }
                  
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return { messages, isLoading, sendMessage, clearMessages };
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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API and auth requests to BFF in development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

## Environment Variables

### File: `.env.local`

```bash
# No sensitive variables needed in frontend!
# All auth is handled by BFF

# Optional: for direct Mastra client usage (if needed)
# VITE_API_URL=http://localhost:3000
```

## Comparison: Before vs After

### Before (Client-Side MSAL)

```typescript
// 50+ lines of MSAL configuration
import { PublicClientApplication, Configuration } from '@azure/msal-browser';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';

const msalConfig: Configuration = { /* ... */ };
const msalInstance = new PublicClientApplication(msalConfig);

// Token acquisition with error handling
async function getAccessToken() {
  try {
    const response = await msalInstance.acquireTokenSilent({ /* ... */ });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.loginRedirect({ /* ... */ });
    }
  }
}

// Every API call needs the token
const response = await fetch('/api/endpoint', {
  headers: {
    Authorization: `Bearer ${await getAccessToken()}`,
  },
});
```

### After (BFF)

```typescript
// Just fetch with credentials
const response = await fetch('/api/endpoint', {
  credentials: 'include',
});
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
  await sendMessage(content);
} catch (error) {
  // Show error toast or inline message
  toast.error('Failed to send message. Please try again.');
}
```
