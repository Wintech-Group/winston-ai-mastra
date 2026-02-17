# Frontend Integration

## Overview

This document describes how to integrate Microsoft authentication in a React + Vite frontend using MSAL.js. The frontend handles the OAuth 2.0 flow and provides access tokens to the Mastra backend.

## Installation

```bash
pnpm add @azure/msal-browser @azure/msal-react @mastra/client-js
```

## MSAL Configuration

### File: `src/lib/msal-config.ts`

```typescript
import { 
  PublicClientApplication, 
  Configuration,
  LogLevel,
  BrowserCacheLocation,
} from '@azure/msal-browser';

/**
 * MSAL configuration
 * See: https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications
 */
const msalConfig: Configuration = {
  auth: {
    // Application (client) ID from Azure App Registration
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    
    // Authority URL for your tenant
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    
    // Where to redirect after login
    redirectUri: window.location.origin,
    
    // Where to redirect after logout
    postLogoutRedirectUri: window.location.origin,
    
    // Navigate to the original page after login
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // Use sessionStorage for better security (clears on tab close)
    // Use localStorage for persistent sessions
    cacheLocation: BrowserCacheLocation.SessionStorage,
    
    // Recommended for security
    storeAuthStateInCookie: false,
  },
  system: {
    // Logging for debugging (disable in production)
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Info : LogLevel.Error,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
    },
    // Timeout for API requests
    tokenRenewalOffsetSeconds: 300, // Renew 5 minutes before expiry
  },
};

/**
 * Scopes to request during login
 * 
 * The .default scope requests all permissions configured in the App Registration
 */
export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/.default`],
};

/**
 * Create and export the MSAL instance
 * Initialize this once at app startup
 */
export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Initialize MSAL (call this before rendering the app)
 */
export async function initializeMsal(): Promise<void> {
  // Handle redirect promise (required for redirect flow)
  await msalInstance.initialize();
  
  // Handle the response from a redirect
  const response = await msalInstance.handleRedirectPromise();
  
  if (response) {
    // User just logged in via redirect
    msalInstance.setActiveAccount(response.account);
  } else {
    // Check if there's an existing session
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }
}
```

## Mastra Client Integration

### File: `src/lib/mastra-client.ts`

```typescript
import { MastraClient } from '@mastra/client-js';
import { msalInstance, loginRequest } from './msal-config';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

/**
 * Gets an access token for the Mastra API
 * Handles silent token acquisition with fallback to interactive login
 */
async function getAccessToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  
  if (!account) {
    // No active session - trigger login
    await msalInstance.loginRedirect(loginRequest);
    throw new Error('Redirecting to login...');
  }
  
  try {
    // Try to get token silently (from cache or refresh)
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Token expired and refresh failed - need interactive login
      await msalInstance.loginRedirect(loginRequest);
      throw new Error('Redirecting to login...');
    }
    throw error;
  }
}

/**
 * Creates a MastraClient instance with authentication
 */
export async function getMastraClient(): Promise<MastraClient | null> {
  try {
    const accessToken = await getAccessToken();
    
    return new MastraClient({
      baseUrl: import.meta.env.VITE_MASTRA_URL || 'http://localhost:4111',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error('Failed to create Mastra client:', error);
    return null;
  }
}

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return msalInstance.getActiveAccount() !== null;
}

/**
 * Trigger logout
 */
export async function logout(): Promise<void> {
  const account = msalInstance.getActiveAccount();
  
  // Call backend to clear token cache
  try {
    const client = await getMastraClient();
    if (client) {
      await fetch(`${import.meta.env.VITE_MASTRA_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      });
    }
  } catch (error) {
    console.warn('Failed to clear backend token cache:', error);
  }
  
  // Logout from MSAL
  await msalInstance.logoutRedirect({
    account,
    postLogoutRedirectUri: window.location.origin,
  });
}
```

## React Hooks

### File: `src/hooks/useAuth.ts`

```typescript
import { useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../lib/msal-config';
import { logout as msalLogout } from '../lib/mastra-client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    name: string;
    email: string;
  } | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Set loading to false once MSAL is done initializing
    if (inProgress === 'none') {
      setIsLoading(false);
    }
  }, [inProgress]);
  
  const login = useCallback(async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [instance]);
  
  const logout = useCallback(async () => {
    try {
      await msalLogout();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, []);
  
  const user = accounts.length > 0 ? {
    name: accounts[0].name || 'Unknown',
    email: accounts[0].username || '',
  } : null;
  
  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
  };
}
```

### File: `src/hooks/useMastraClient.ts`

```typescript
import { useEffect, useState, useRef } from 'react';
import { MastraClient } from '@mastra/client-js';
import { getMastraClient, isAuthenticated } from '../lib/mastra-client';

/**
 * Hook that provides a MastraClient instance
 * Automatically refreshes the client when the token changes
 */
export function useMastraClient(): {
  client: MastraClient | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [client, setClient] = useState<MastraClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    
    async function initClient() {
      if (!isAuthenticated()) {
        setClient(null);
        setIsLoading(false);
        return;
      }
      
      try {
        const mastraClient = await getMastraClient();
        
        if (mountedRef.current) {
          setClient(mastraClient);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to initialize client'));
          setClient(null);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }
    
    initClient();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return { client, isLoading, error };
}
```

### File: `src/hooks/useCapabilities.ts`

```typescript
import { useEffect, useState } from 'react';
import { getMastraClient } from '../lib/mastra-client';

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

/**
 * Hook that fetches the current user's capabilities from the backend
 */
export function useCapabilities(): {
  capabilities: Capabilities | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  async function fetchCapabilities() {
    setIsLoading(true);
    setError(null);
    
    try {
      const client = await getMastraClient();
      
      if (!client) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_MASTRA_URL}/api/my-capabilities`,
        {
          headers: client.headers,
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
      }
      
      const data = await response.json();
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

## React Components

### File: `src/App.tsx`

```typescript
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './lib/msal-config';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './hooks/useAuth';

function AppContent() {
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

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppContent />
    </MsalProvider>
  );
}
```

### File: `src/components/LoginPage.tsx`

```typescript
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">
          Mastra Docs Bot
        </h1>
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
              {user?.name}
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
import { getMastraClient } from '../lib/mastra-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    
    try {
      const client = await getMastraClient();
      
      if (!client) {
        throw new Error('Not authenticated');
      }
      
      // Get the orchestrator agent
      const agent = client.getAgent('orchestrator');
      
      // Stream the response
      const response = await agent.stream({
        messages: [{ role: 'user', content: userMessage }],
      });
      
      let assistantMessage = '';
      
      for await (const chunk of response) {
        if (chunk.type === 'text-delta') {
          assistantMessage += chunk.text;
          
          // Update the message in real-time
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
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
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

## App Entry Point

### File: `src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeMsal } from './lib/msal-config';
import './index.css';

// Initialize MSAL before rendering
initializeMsal().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

## Environment Variables

### File: `.env.local`

```bash
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_CLIENT_ID=your-client-id
VITE_MASTRA_URL=http://localhost:4111
```

## TypeScript Configuration

Add environment variable types:

### File: `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_TENANT_ID: string;
  readonly VITE_AZURE_CLIENT_ID: string;
  readonly VITE_MASTRA_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Handling Token Refresh

MSAL automatically handles token refresh in the background. However, you should handle cases where refresh fails:

```typescript
// src/lib/mastra-client.ts - Enhanced error handling

import { InteractionRequiredAuthError, BrowserAuthError } from '@azure/msal-browser';

async function getAccessToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  
  if (!account) {
    await msalInstance.loginRedirect(loginRequest);
    throw new Error('Redirecting to login...');
  }
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return response.accessToken;
  } catch (error) {
    // Handle specific error types
    if (error instanceof InteractionRequiredAuthError) {
      // User needs to re-authenticate
      await msalInstance.loginRedirect(loginRequest);
      throw new Error('Redirecting to login...');
    }
    
    if (error instanceof BrowserAuthError) {
      // Browser-specific error (popup blocked, etc.)
      console.error('Browser auth error:', error.errorCode);
      
      // Fall back to redirect if popup fails
      if (error.errorCode === 'popup_window_error') {
        await msalInstance.loginRedirect(loginRequest);
        throw new Error('Redirecting to login...');
      }
    }
    
    throw error;
  }
}
```
