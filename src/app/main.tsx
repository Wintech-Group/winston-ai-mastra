import "./index.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"
import type { AuthContext } from "./lib/auth"

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
  // TODO: Replace with real auth from MSAL
  const auth: AuthContext = {
    isAuthenticated: false,
    user: null,
    login: async () => {},
    logout: async () => {},
  }

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
