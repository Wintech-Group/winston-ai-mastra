import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { RouterContext } from "../router-context"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  const { auth } = Route.useRouteContext()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2">
            <span className="font-semibold text-lg mr-4">Winston AI</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/chat" activeProps={{ className: "font-bold" }}>
                Chat
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin" activeProps={{ className: "font-bold" }}>
                Admin
              </Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            {auth.user?.displayName ?
              <span className="text-sm text-muted-foreground">
                {auth.user.displayName}
              </span>
            : null}

            {auth.isAuthenticated ?
              <Button
                variant="outline"
                size="sm"
                onClick={() => auth.logout()}
                disabled={auth.isLoading}
              >
                Sign out
              </Button>
            : <Button
                variant="outline"
                size="sm"
                asChild
                disabled={auth.isLoading}
              >
                <Link to="/login">Sign in</Link>
              </Button>
            }
          </div>
        </div>
      </header>
      <Separator />
      <main>
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </div>
  )
}
