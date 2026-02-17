import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})

function ChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <ScrollArea className="flex-1 p-4">
        <p className="text-muted-foreground">
          Start a conversation with Winston...
        </p>
      </ScrollArea>
      <Separator />
      <div className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            // TODO: wire up to mastra-client
          }}
          className="flex gap-2"
        >
          <Input type="text" placeholder="Ask Winston..." className="flex-1" />
          <Button type="submit">Send</Button>
        </form>
      </div>
    </div>
  )
}
