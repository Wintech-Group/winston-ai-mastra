import { createFileRoute } from "@tanstack/react-router"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useCallback, useRef, useState } from "react"
import { BotIcon, BrainIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseDocumentSegments } from "@/lib/parse-documents"
import { mockMessages } from "@/mocks/chat-response"
import { DocumentCard } from "@/components/document-card"

import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  Artifact,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact"

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
import { ScrollArea } from "@/components/ui/scroll-area"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})

type ActiveArtifact = { title: string; content: string } | null

/** Toggle to true to load mock data instead of calling the API */
const USE_MOCK = true

const suggestions = [
  "What can you help me with?",
  "Summarise our company policies",
  "What's the weather like today?",
  "Help me draft an email",
]

function ChatPage() {
  const threadIdRef = useRef(crypto.randomUUID())

  const transport = new DefaultChatTransport({
    api: "/winston/chat",
    credentials: "include",
    headers: {
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    prepareSendMessagesRequest({ messages }) {
      return {
        body: {
          messages,
          memory: {
            thread: threadIdRef.current,
          },
        },
      }
    },
  })

  const chat = useChat({ transport })

  const messages = USE_MOCK ? mockMessages : chat.messages
  const status = USE_MOCK ? ("ready" as const) : chat.status
  const sendMessage = chat.sendMessage
  const stop = chat.stop

  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact>(null)

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
    <div className="flex h-full min-h-0 w-full">
      {/* Chat column */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300",
          activeArtifact ? "lg:max-w-[55%]" : "mx-auto max-w-6xl",
        )}
      >
        <div
          className={cn(
            "transition-all duration-500 ease-in-out",
            isEmpty ?
              "h-0 overflow-hidden opacity-0 pointer-events-none"
            : "min-h-0 flex-1 opacity-100",
          )}
        >
          <Conversation>
            <ConversationContent>
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
                        case "text": {
                          const segments = parseDocumentSegments(part.text)
                          // If no documents, render as before
                          if (
                            segments.length === 1 &&
                            segments[0]?.type === "text"
                          ) {
                            return (
                              <MessageResponse key={key}>
                                {part.text}
                              </MessageResponse>
                            )
                          }
                          return segments.map((seg, si) => {
                            const segKey = `${key}-seg-${si}`
                            if (seg.type === "document") {
                              return (
                                <DocumentCard
                                  key={segKey}
                                  title={seg.title}
                                  active={activeArtifact?.title === seg.title}
                                  onSelect={() =>
                                    setActiveArtifact(
                                      activeArtifact?.title === seg.title ?
                                        null
                                      : {
                                          title: seg.title,
                                          content: seg.content,
                                        },
                                    )
                                  }
                                />
                              )
                            }
                            return (
                              <MessageResponse key={segKey}>
                                {seg.content}
                              </MessageResponse>
                            )
                          })
                        }
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
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BrainIcon className="size-4" />
                      <Shimmer duration={1}>Loading...</Shimmer>
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        <div
          className={cn(
            "grid shrink-0 gap-4 px-4 pb-4 transition-all duration-500 ease-in-out",
            isEmpty ? "my-auto w-full max-w-4xl self-center" : "mt-auto w-full",
          )}
        >
          {isEmpty && (
            <ConversationEmptyState
              className="gap-2 p-0"
              title="Chat with Winston"
              description="Ask anything - Winston is ready to help."
              icon={<BotIcon className="size-8" />}
            />
          )}
          {isEmpty && (
            <Suggestions className="px-1">
              {suggestions.map((s) => (
                <Suggestion
                  key={s}
                  suggestion={s}
                  onClick={handleSuggestionClick}
                />
              ))}
            </Suggestions>
          )}
          <div className="w-full">
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

      {/* Artifact panel */}
      {activeArtifact && (
        <div
          className={cn(
            "fixed inset-0 z-40 flex flex-col bg-background p-8",
            "xl:relative xl:inset-auto xl:z-auto xl:h-full xl:max-w-[55%] xl:flex-1",
          )}
        >
          <Artifact className="h-full">
            <ArtifactHeader>
              <ArtifactTitle>{activeArtifact.title}</ArtifactTitle>
              <ArtifactClose onClick={() => setActiveArtifact(null)} />
            </ArtifactHeader>
            <ArtifactContent className="overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                  <MessageResponse>{activeArtifact.content}</MessageResponse>
                </div>
              </ScrollArea>
            </ArtifactContent>
          </Artifact>
        </div>
      )}
    </div>
  )
}
