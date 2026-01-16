/**
 * Authentication type definitions
 */

export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  tokens: AuthTokens | null
}

export interface AuthUser {
  id: string
  email: string
  username?: string
  displayName?: string
  isAdmin?: string | number
  metadata?: Record<string, unknown>
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface DbUser {
  id: string
  email: string
  username?: string
  displayName?: string
  bitcoinAddress?: string
  totalPowPoints?: number | string
  isAdmin?: string | number
  createdAt?: string
  updatedAt?: string
  blogName?: string
  blogDescription?: string
  blogTheme?: string
  invitedBy?: string
  profileImageUrl?: string
  [key: string]: unknown
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  displayName?: string
  metadata?: {
    username?: string
    bitcoinAddress?: string
    inviteCode?: string
    [key: string]: unknown
  }
}

export interface AuthContextType {
  authState: AuthState
  dbUser: DbUser | null
  loading: boolean
  siteSettings: import('../lib/site-settings').SiteSettings | null
  refreshSettings: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (payload: RegisterPayload) => Promise<AuthUser | null>
  signOut: () => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}
