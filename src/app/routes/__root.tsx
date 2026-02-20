import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { BotIcon, ShieldIcon } from "lucide-react"
import type { RouterContext } from "../router-context"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../components/ui/sidebar"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  const { auth } = Route.useRouteContext()

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="h-14 px-4">
          <div className="flex h-full items-center justify-between gap-4">
            <span className="text-lg font-semibold">Winston AI</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => auth.login()}
              disabled={auth.isLoading}
            >
              Sign in
            </Button>
          </div>
        </header>
        <Separator />
        <main>
          <Outlet />
        </main>
        {import.meta.env.DEV && (
          <TanStackRouterDevtools position="bottom-left" />
        )}
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <SidebarProvider className="h-full">
        <Sidebar>
          <SidebarHeader>
            <span className="hidden text-lg font-semibold md:inline">
              Winston AI
            </span>
            <span className="text-lg font-semibold md:hidden">W</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to="/chat"
                    activeProps={{ className: "bg-muted font-semibold" }}
                  >
                    <BotIcon className="size-4" />
                    <span className="hidden md:inline">Chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to="/admin"
                    activeProps={{ className: "bg-muted font-semibold" }}
                  >
                    <ShieldIcon className="size-4" />
                    <span className="hidden md:inline">Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="h-14 px-4">
            <div className="flex h-full items-center justify-end gap-2">
              {auth.user?.name ?
                <span className="text-sm text-muted-foreground">
                  {auth.user.name}
                </span>
              : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => auth.logout()}
                disabled={auth.isLoading}
              >
                Sign out
              </Button>
            </div>
          </header>
          <Separator />
          <main className="min-h-0 flex-1">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </div>
  )
}
