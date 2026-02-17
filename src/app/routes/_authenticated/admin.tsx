import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const roles = context.auth.user?.roles ?? []
    if (!roles.includes("admin")) {
      throw redirect({ to: "/chat" })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold tracking-tight">Admin</h2>
      <Separator className="my-4" />
      <Outlet />
    </div>
  )
}
