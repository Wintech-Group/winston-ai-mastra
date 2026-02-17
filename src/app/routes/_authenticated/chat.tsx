import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})

function ChatPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        <p style={{ color: "#6b7280" }}>Start a conversation with Winston...</p>
      </div>
      <div style={{ borderTop: "1px solid #e5e7eb", padding: "1rem" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            // TODO: wire up to mastra-client
          }}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            type="text"
            placeholder="Ask Winston..."
            style={{ flex: 1, padding: "0.5rem", fontSize: "1rem" }}
          />
          <button type="submit" style={{ padding: "0.5rem 1rem" }}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
