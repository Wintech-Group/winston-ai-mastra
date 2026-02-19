import { Mastra } from "@mastra/core/mastra"
// import { PinoLogger } from "@mastra/loggers"
import {
  Observability,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from "@mastra/observability"
import { weatherWorkflow } from "./workflows/weather-workflow"
import { weatherAgent } from "./agents/weather-agent"
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from "./scorers/weather-scorer"
import { PostgresStore } from "@mastra/pg"
import { githubWebhookRoute } from "./webhooks/github"
import { VercelDeployer } from "@mastra/deployer-vercel"
import {
  authLoginRoute,
  authCallbackRoute,
  authLogoutRoute,
  authMeRoute,
  sessionAuthMiddleware,
} from "./auth"

export const mastra = new Mastra({
  agents: { weatherAgent },
  deployer: new VercelDeployer(),
  bundler: {
    externals: ["canvas", "linkedom", "pdfmake", "marked"],
  },
  workflows: { weatherWorkflow },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  storage: new PostgresStore({
    id: "mastra-storage",
    connectionString: process.env.SUPABASE_CONNECTION_STRING,
    schemaName: process.env.SUPABASE_SCHEMA,
    ssl:
      process.env.NODE_ENV === "production" ?
        { rejectUnauthorized: false }
      : undefined,
  }),
  // logger: new PinoLogger({
  //   name: "Mastra",
  //   level: process.env.NODE_ENV === "production" ? "info" : "debug",
  // }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
  server: {
    apiRoutes: [
      githubWebhookRoute,
      authLoginRoute,
      authCallbackRoute,
      authLogoutRoute,
      authMeRoute,
    ],
    middleware: [
      {
        path: "/api/*",
        handler: sessionAuthMiddleware,
      },
    ],
    cors: {
      origin: process.env.APP_URL ?? "http://localhost:5173",
      credentials: true,
    },
  },
})
