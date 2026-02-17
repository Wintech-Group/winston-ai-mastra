import "./index.css"
import { StrictMode, useEffect, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MsalProvider, useMsal } from "@azure/msal-react"
import { routeTree } from "./routeTree.gen"
import type { AuthContext } from "./lib/auth"
import { initializeMsal, loginRequest, msalInstance } from "./lib/msal-config"

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient,
  },
  defaultPreloadStaleTime: 0,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppWithAuth />
    </MsalProvider>
  )
}

function AppWithAuth() {
  const { instance, accounts, inProgress } = useMsal()
  const firstAccount = accounts[0]

  useEffect(() => {
    if (!instance.getActiveAccount() && firstAccount) {
      instance.setActiveAccount(firstAccount)
    }
  }, [firstAccount, instance])

  const account = instance.getActiveAccount() ?? firstAccount ?? null
  const isLoading = inProgress !== "none"
  const isAuthenticated = !!account

  useEffect(() => {
    void router.invalidate()
  }, [isAuthenticated, isLoading])

  const auth = useMemo<AuthContext>(
    () => ({
      isAuthenticated,
      isLoading,
      user:
        account ?
          {
            email: account.username,
            displayName: account.name ?? account.username,
            roles: ["staff"],
          }
        : null,
      login: async () => {
        await instance.loginRedirect(loginRequest)
      },
      logout: async () => {
        await instance.logoutRedirect({
          account: account ?? undefined,
          postLogoutRedirectUri: window.location.origin,
        })
      },
    }),
    [account, instance, isAuthenticated, isLoading],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth, queryClient }} />
    </QueryClientProvider>
  )
}

const rootEl = document.getElementById("root")!

initializeMsal()
  .then(() => {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error("Failed to initialize MSAL", error)
    createRoot(rootEl).render(
      <StrictMode>
        <div className="p-6 text-destructive">Authentication setup failed.</div>
      </StrictMode>,
    )
  })
