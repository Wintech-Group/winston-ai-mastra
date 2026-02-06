/**
 * Supabase client singleton
 *
 * Provides a typed Supabase client for direct database operations
 * using the service role key for backend operations.
 *
 * Note: You must call .schema("config") on all queries to access
 * the config schema tables.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../types/database.types"

// Module-level cached instance
let supabaseClient: SupabaseClient<Database> | null = null

/**
 * Get the Supabase client singleton
 *
 * Uses SUPABASE_URL and SUPABASE_SECRET_KEY environment variables.
 * The secret key provides full access - only use in backend services.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient
  }

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Missing required Supabase configuration. " +
        "Ensure SUPABASE_URL and SUPABASE_SECRET_KEY are set.",
    )
  }

  supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseClient
}

/**
 * Reset the client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null
}
