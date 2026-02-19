import { createFileRoute } from "@tanstack/react-router"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useCallback } from "react"
import { BotIcon } from "lucide-react"

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})

const transport = new DefaultChatTransport({
  api: "/winston/chat",
  credentials: "include",
  headers: {
    "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
})

const suggestions = [
  "What can you help me with?",
  "Summarise our company policies",
  "What's the weather like today?",
  "Help me draft an email",
]

function ChatPage() {
  const { messages, status, sendMessage, stop } = useChat({ transport })

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text.trim()) return
      sendMessage({ text: message.text })
    },
    [sendMessage],
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion })
    },
    [sendMessage],
  )

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col max-w-7xl mx-auto">
      <Conversation>
        <ConversationContent>
          {isEmpty && (
            <ConversationEmptyState
              title="Chat with Winston"
              description="Ask anything — Winston is ready to help."
              icon={<BotIcon className="size-8" />}
            />
          )}
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  const key = `${message.id}-${i}`
                  switch (part.type) {
                    case "reasoning":
                      return (
                        <Reasoning
                          key={key}
                          isStreaming={
                            status === "streaming" &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      )
                    case "text":
                      return (
                        <MessageResponse key={key}>{part.text}</MessageResponse>
                      )
                    default: {
                      if (part.type.startsWith("tool-")) {
                        const toolPart = part as import("ai").ToolUIPart
                        return (
                          <Tool key={key}>
                            <ToolHeader
                              type={toolPart.type}
                              state={toolPart.state}
                            />
                            <ToolContent>
                              <ToolInput input={toolPart.input} />
                              {"output" in toolPart &&
                                toolPart.output !== undefined && (
                                  <ToolOutput
                                    output={toolPart.output}
                                    errorText={
                                      "errorText" in toolPart ?
                                        String(toolPart.errorText)
                                      : undefined
                                    }
                                  />
                                )}
                            </ToolContent>
                          </Tool>
                        )
                      }
                      return null
                    }
                  }
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="grid shrink-0 gap-4 pt-4">
        {isEmpty && (
          <Suggestions className="px-4">
            {suggestions.map((s) => (
              <Suggestion
                key={s}
                suggestion={s}
                onClick={handleSuggestionClick}
              />
            ))}
          </Suggestions>
        )}
        <div className="w-full px-4 pb-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask Winston..." />
            </PromptInputBody>
            <PromptInputFooter>
              <div />
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}
