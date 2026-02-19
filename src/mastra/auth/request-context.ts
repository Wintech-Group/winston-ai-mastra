/**
 * Zod schema and inferred type for the session data surfaced via Mastra's
 * RequestContext. Only non-sensitive fields are included — tokens stay
 * server-side and never reach the agent layer.
 *
 * The schemas are bound to the Session/SessionUserInfo interfaces via
 * `satisfies`, so TypeScript will error here if the interfaces ever drift.
 */

import { z } from "zod"
import type { Session, SessionUserInfo } from "./session-store"

const sessionUserInfoSchema = z.object({
  name: z.string().optional(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  email: z.string().optional(),
  preferredUsername: z.string().optional(),
  groups: z.array(z.string()).optional(),
}) satisfies z.ZodType<SessionUserInfo>

const sessionContextValueSchema = z.object({
  userId: z.string(),
  userInfo: sessionUserInfoSchema,
}) satisfies z.ZodType<Pick<Session, "userId" | "userInfo">>

export const sessionContextSchema = z.object({
  session: sessionContextValueSchema.optional(),
  timezone: z.string().optional(),
})

export type SessionContextType = z.infer<typeof sessionContextSchema>
