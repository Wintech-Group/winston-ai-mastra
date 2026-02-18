import "./index.css"
import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "./components/theme-provider"
import { useAuth } from "./hooks/useAuth"

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
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppWithAuth />
    </ThemeProvider>
  )
}

function AppWithAuth() {
  const auth = useAuth()

  useEffect(() => {
    void router.invalidate()
  }, [auth.isAuthenticated, auth.isLoading])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth, queryClient }} />
    </QueryClientProvider>
  )
}

const rootEl = document.getElementById("root")!

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
