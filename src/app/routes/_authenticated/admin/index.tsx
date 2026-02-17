import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
})

function AdminDashboard() {
  return (
    <div>
      <h3>Dashboard</h3>
      <p>Admin dashboard coming soon.</p>
    </div>
  )
}
