import type { QueryClient } from "@tanstack/react-query"
import type { AuthContext } from "./lib/auth"

export interface RouterContext {
  auth: AuthContext
  queryClient: QueryClient
}
