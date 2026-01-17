/**
 * Auth Context Provider
 * Centralizes authentication state and logic to prevent duplication
 * and memory leaks from multiple onAuthStateChanged subscriptions
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import db from '../lib/db-client'
import { AuthState, DbUser, LoginCredentials, RegisterPayload, AuthContextType } from '../types/auth'
import { getSiteSettings, SiteSettings } from '../lib/site-settings'
import { subscribeToChannel } from '../lib/realtime-manager'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    tokens: null
  })
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [isDbLoading, setIsDbLoading] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // Main loading state should only reflect auth status to prevent UI hang on DB lookup
  // components can check dbUser or isDbLoading specifically if they need it
  const loading = isAuthLoading

  // Safety timeout: force loading to false after 4 seconds if SDK hangs
  useEffect(() => {
    if (!isAuthLoading) return
    
    const timeout = setTimeout(() => {
      console.warn('[AuthContext] Auth loading safety timeout reached. Forcing isAuthLoading to false.')
      setIsAuthLoading(false)
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }, 10000)

    return () => clearTimeout(timeout)
  }, [isAuthLoading])

  // Second safety timeout for isDbLoading in case database query hangs
  useEffect(() => {
    if (!isDbLoading) return
    
    const timeout = setTimeout(() => {
      console.warn('[AuthContext] DB user loading safety timeout reached. Forcing isDbLoading to false.')
      setIsDbLoading(false)
    }, 5000) // 5s for DB lookup is plenty

    return () => clearTimeout(timeout)
  }, [isDbLoading])

  // Single subscription to auth state - runs only once
  useEffect(() => {
    let mounted = true
    // Ref to track the latest user ID we are trying to load
    let currentUserId: string | null = null;

    console.log('[AuthContext] Subscribing to auth state changes')
    
    // Setup real-time listener for PoW updates to keep local dbUser in sync
    // NOTE: Only set up after authentication is confirmed (realtime requires JWT)
    let unsubscribeRealtime: (() => void) | null = null;
    const setupRealtime = async (userId: string) => {
      // Only attempt realtime subscription when authenticated
      if (!db.auth.isAuthenticated()) {
        return;
      }
      
      try {
        unsubscribeRealtime = await subscribeToChannel('global-stats-updates', `auth-context-${userId}`, (message: any) => {
          if (!mounted) return;
          
          const payload = message.payload || message.data || message;
          if (payload.type === 'stats-updated' && payload.userId === userId) {
            console.log('[AuthContext] Received PoW update for current user, updating points:', payload.pointsAdded);
            setDbUser(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                totalPowPoints: (Number(prev.totalPowPoints) || 0) + payload.pointsAdded
              };
            });
          }
        });
      } catch (err) {
        // Silently handle realtime errors - it's a non-critical enhancement
        console.warn('[AuthContext] Failed to subscribe to real-time updates:', err);
      }
    };

    const unsubscribe = db.auth.onAuthStateChanged((state) => {
      if (!mounted) return
      
      console.log('[AuthContext] Auth state changed:', JSON.stringify({
        hasUser: !!state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated
      }))

      setAuthState({
        user: state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated,
        tokens: state.tokens || null
      })

      setIsAuthLoading(state.isLoading)
      
      // Load full user data if authenticated
      if (state.user?.id) {
        currentUserId = state.user.id
        loadDbUser(state.user.id, () => {
          return mounted && currentUserId === state.user?.id
        })
        // Setup realtime subscription now that user is authenticated
        setupRealtime(state.user.id)
      } else {
        currentUserId = null
        setDbUser(null)
        setIsDbLoading(false)
        // Cleanup realtime when user logs out
        if (unsubscribeRealtime) {
          unsubscribeRealtime()
          unsubscribeRealtime = null
        }
      }
    })

    // Cleanup subscription on unmount
    return () => {
      console.log('[AuthContext] Unsubscribing from auth state changes')
      mounted = false
      unsubscribe()
      if (unsubscribeRealtime) unsubscribeRealtime()
    }
  }, []) // Empty deps - subscribe only once on mount

  // Load site settings with graceful fallback
  const refreshSettings = useCallback(async () => {
    try {
      const s = await getSiteSettings(true)
      setSiteSettings(s)
    } catch (e: any) {
      // Only log unexpected errors (network errors are handled in getSiteSettings)
      const isNetworkError = 
        e?.code === 'NETWORK_ERROR' ||
        e?.name === 'BlinkNetworkError' ||
        e?.message?.includes('Load failed')
      
      if (!isNetworkError) {
        console.error('[AuthContext] Failed to load site settings:', e)
      }
      // getSiteSettings already returns defaults on error, so no action needed
    }
  }, [])

  useEffect(() => {
    refreshSettings()
    
    // Refresh settings every 5 minutes
    const interval = setInterval(refreshSettings, 300000)
    return () => clearInterval(interval)
  }, [refreshSettings])

  /**
   * Load extended user data from database
   */
  const loadDbUser = useCallback(async (userId: string, shouldContinue?: () => boolean) => {
    try {
      // Basic check
      if (shouldContinue && !shouldContinue()) return

      setIsDbLoading(true)
      const users = await db.db.users.list({
        where: { id: userId },
        limit: 1
      })

      // Check again after async op
      if (shouldContinue && !shouldContinue()) return

      if (users && users.length > 0) {
        console.log('[AuthContext] Loaded db user:', { id: userId })
        setDbUser(users[0])
      }
    } catch (error) {
      // Check again
      if (shouldContinue && !shouldContinue()) return

      console.error('[AuthContext] Failed to load user data:', error)
      // Continue even if db load fails - auth still valid
    } finally {
      if (!shouldContinue || shouldContinue()) {
        setIsDbLoading(false)
      }
    }
  }, [])

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Signing in with email:', email)
      await db.auth.signInWithEmail(email, password)
      console.log('[AuthContext] Sign in successful')
    } catch (error) {
      console.error('[AuthContext] Sign in failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (payload: RegisterPayload) => {
    try {
      console.log('[AuthContext] Signing up with email:', payload.email)
      const user = await db.auth.signUp({
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
        metadata: payload.metadata
      })
      console.log('[AuthContext] Sign up successful:', { id: user?.id })
      return user || null
    } catch (error) {
      console.error('[AuthContext] Sign up failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      console.log('[AuthContext] Signing out')
      await db.auth.signOut()
      console.log('[AuthContext] Sign out successful')
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error)
      throw error
    }
  }, [])

  const value: AuthContextType = {
    authState,
    dbUser,
    loading,
    isAuthLoading,
    isDbLoading,
    siteSettings,
    refreshSettings,
    signIn,
    signUp,
    signOut,
    logout: signOut,
    isAuthenticated: authState.isAuthenticated
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 * Ensures it's used within AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export default AuthContext
