import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/chat" })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return <div className="min-h-[calc(100vh-57px)]" />
}
