import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { RouterContext } from "../router-context"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <header style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <strong>Winston AI</strong>
          <Link to="/chat" activeProps={{ style: { fontWeight: "bold" } }}>
            Chat
          </Link>
          <Link to="/admin" activeProps={{ style: { fontWeight: "bold" } }}>
            Admin
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </>
  )
}
