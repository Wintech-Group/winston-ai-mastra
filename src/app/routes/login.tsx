import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { auth } = Route.useRouteContext()

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1>Winston AI</h1>
        <p>Sign in to continue</p>
        <button
          onClick={() => auth.login()}
          style={{
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  )
}
