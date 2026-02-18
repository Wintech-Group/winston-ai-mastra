import { useState, useEffect, useCallback } from "react"
import type { AuthContext, User } from "../lib/auth"

export function useAuth(): AuthContext {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user?: User }) => {
        setUser(data.authenticated ? (data.user ?? null) : null)
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(() => {
    window.location.href = "/auth/login"
  }, [])

  const logout = useCallback(async () => {
    try {
      const data = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      }).then((res) => res.json() as Promise<{ logoutUrl?: string }>)
      window.location.href = data.logoutUrl ?? "/"
    } catch {
      window.location.href = "/"
    }
    setUser(null)
  }, [])

  return {
    isAuthenticated: user !== null,
    isLoading,
    user,
    login,
    logout,
  }
}
