/**
 * Session store backed by Supabase (mastra_auth.sessions table).
 *
 * Used by the auth routes to persist OAuth sessions server-side.
 * The browser only receives an httpOnly session cookie —
 * tokens never touch JavaScript.
 */

import { getSupabaseClient } from "../../services/supabase-client"

export interface SessionUserInfo {
  name?: string
  email?: string
  groups?: string[]
}

export interface Session {
  id: string
  userId: string
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  userInfo: SessionUserInfo
}

function authSchema() {
  return getSupabaseClient().schema("mastra_auth")
}

async function upsertUser(
  userId: string,
  userInfo: SessionUserInfo,
): Promise<void> {
  const { error } = await authSchema()
    .from("users")
    .upsert({
      id: userId,
      display_name: userInfo.name ?? null,
      email: userInfo.email ?? null,
      groups: userInfo.groups ?? null,
    })

  if (error) throw new Error(`Failed to upsert user: ${error.message}`)
}

export async function createSession(session: Session): Promise<void> {
  await upsertUser(session.userId, session.userInfo)

  const { error } = await authSchema()
    .from("sessions")
    .insert({
      id: session.id,
      user_id: session.userId,
      access_token: session.accessToken,
      refresh_token: session.refreshToken ?? null,
      expires_at: session.expiresAt.toISOString(),
    })

  if (error) throw new Error(`Failed to create session: ${error.message}`)
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await authSchema()
    .from("sessions")
    .select("*, users(display_name, email, groups)")
    .eq("id", sessionId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // not found
    throw new Error(`Failed to get session: ${error.message}`)
  }

  const profile = (data.users ?? null) as {
    display_name: string | null
    email: string | null
    groups: string[] | null
  } | null

  return {
    id: data.id,
    userId: data.user_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? undefined,
    expiresAt: new Date(data.expires_at),
    userInfo: {
      name: profile?.display_name ?? undefined,
      email: profile?.email ?? undefined,
      groups: profile?.groups ?? undefined,
    },
  }
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<Session, "accessToken" | "refreshToken" | "expiresAt">>,
): Promise<void> {
  const patch: Record<string, unknown> = {}

  if (updates.accessToken) patch.access_token = updates.accessToken
  if (updates.refreshToken) patch.refresh_token = updates.refreshToken
  if (updates.expiresAt) patch.expires_at = updates.expiresAt.toISOString()

  const { error } = await authSchema()
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)

  if (error) throw new Error(`Failed to update session: ${error.message}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await authSchema()
    .from("sessions")
    .delete()
    .eq("id", sessionId)

  if (error) throw new Error(`Failed to delete session: ${error.message}`)
}

export async function deleteExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await authSchema()
    .from("sessions")
    .delete()
    .lt("expires_at", cutoff)
    .select("id")

  if (error)
    throw new Error(`Failed to delete expired sessions: ${error.message}`)
  return data?.length ?? 0
}
