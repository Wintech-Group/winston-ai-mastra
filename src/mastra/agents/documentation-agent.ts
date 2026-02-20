import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { sessionContextSchema } from "../auth/request-context"

export const documentationAgent = new Agent({
  id: "documentation-agent",
  name: "Documentation Agent",
  description:
    "An agent that helps create, update and otherwise manage controlled documentation tasks e.g. policy management.",
  requestContextSchema: sessionContextSchema,
  instructions: ({ requestContext }) => {
    return `
  
  `
  },
  model: "openai/gpt-5-mini",
  defaultOptions: {
    providerOptions: {
      openai: {
        reasoningSummary: "auto",
      },
    },
  },
  memory: new Memory({ options: { observationalMemory: true } }),
})
