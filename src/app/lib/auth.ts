export interface User {
  email: string
  displayName: string
  roles: ("staff" | "policy_owner" | "domain_owner" | "admin")[]
}

export interface AuthContext {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  login: () => Promise<void>
  logout: () => Promise<void>
}
