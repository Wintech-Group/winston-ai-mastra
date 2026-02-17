import { createFileRoute } from "@tanstack/react-router"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
})

function AdminDashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>Admin dashboard coming soon.</CardDescription>
      </CardHeader>
    </Card>
  )
}
