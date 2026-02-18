export interface User {
  name?: string
  email?: string
  groups?: string[]
}

export interface AuthContext {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  login: () => void
  logout: () => Promise<void>
}
