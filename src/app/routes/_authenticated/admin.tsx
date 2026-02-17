import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

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
    <div style={{ padding: "1rem" }}>
      <h2>Admin</h2>
      <Outlet />
    </div>
  )
}
