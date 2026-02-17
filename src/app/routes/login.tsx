import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { auth } = Route.useRouteContext()

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Winston AI</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => auth.login()} size="lg" className="w-full">
            Sign in with Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
