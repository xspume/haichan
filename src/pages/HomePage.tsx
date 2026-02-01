import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Database, Lock, Trophy, MessageSquare, BookOpen, Sparkles, TrendingUp, LayoutGrid, Users } from 'lucide-react'
import db, { publicDb } from '../lib/db-client'
import { GlobalPoWStats } from '../components/views/GlobalPoWStats'
import { PostersList } from '../components/views/PostersList'
import { HashleLeaderboard } from '../components/views/HashleLeaderboard'
import { Announcements } from '../components/views/Announcements'
import { useAuth } from '../contexts/AuthContext'
import { requestCache } from '../lib/request-cache'
import { withRateLimit, isTransientError } from '../lib/rate-limit-utils'
import { subscribeToChannel } from '../lib/realtime-manager'

const MAX_USERS = 256

interface UserMetadata {
  hasSeenHowToStart?: boolean
  firstVisitDate?: string
  [key: string]: any
}

export function HomePage() {
  const { authState, dbUser } = useAuth()
  const [boards, setBoards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [newestUser, setNewestUser] = useState<any>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [showHowToStart, setShowHowToStart] = useState(false)

  useEffect(() => {
    // Load data on mount - HomePage is public, works with or without auth
    const initializeData = async () => {
      let dataLoaded = false;
      
      // Safety timeout: force loading to false if data fetching hangs
      const safetyTimeout = setTimeout(() => {
        if (!dataLoaded) {
          console.warn('[HomePage] Data initialization timed out. Forcing loading to false.');
          setLoading(false);
        }
      }, 8000); // Increased slightly for safety

      try {
        console.log('[HomePage] Starting data load...', { isAuthenticated: authState.isAuthenticated, userId: dbUser?.id })
        
        // Load critical data with higher priority/lower retry delay
        const criticalResults = await Promise.allSettled([
          loadBoards(),
          loadTotalUsers(),
          checkCurrentUser()
        ])
        
        // Log any failures in critical data
        criticalResults.forEach((result, idx) => {
          if (result.status === 'rejected') {
            console.error(`[HomePage] Critical task ${idx} failed:`, result.reason)
          } else {
            console.log(`[HomePage] Critical task ${idx} completed successfully`)
          }
        })

        // Non-critical data second (don't block the UI if they take too long)
        Promise.allSettled([
          loadOnlineUsers(),
          loadNewestUser()
        ])
        
        dataLoaded = true;
        clearTimeout(safetyTimeout);
        setLoading(false)
        
        // Setup real-time subscriptions
        setupRealtimeBoards()
        setupRealtimeUsers()
      } catch (error) {
        console.error('[HomePage] Failed to load page data:', error)
        dataLoaded = true;
        clearTimeout(safetyTimeout);
        setLoading(false)
      }
    }
    
    let unsubscribeBoards: (() => void) | null = null
    let unsubscribeUsers: (() => void) | null = null
    
    const setupRealtimeBoards = async () => {
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribeBoards = await subscribeToChannel(
        'boards-updates',
        'homepage-boards',
        (message: any) => {
          if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
            // Invalidate cache and reload instantly
            requestCache.invalidate('global-top-boards')
            loadBoards()
          }
        }
      )
    }
    
    const setupRealtimeUsers = async () => {
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribeUsers = await subscribeToChannel(
        'users-activity',
        'homepage-users',
        (message: any) => {
          if (message.type === 'user-activity') {
            // Invalidate cache and reload online users instantly
            requestCache.invalidate('homepage-online-users')
            loadOnlineUsers()
          }
          if (message.type === 'user-joined' || message.type === 'user-registered') {
            // Reload newest user and total count instantly
            requestCache.invalidatePattern(/homepage-(newest-user|total-users)/)
            loadNewestUser()
            loadTotalUsers()
          }
        }
      )
    }
    
    initializeData()
    
    return () => {
      unsubscribeBoards?.()
      unsubscribeUsers?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkCurrentUser = async () => {
    if (!dbUser) return

    // Parse metadata to check if user has seen the guide
    let metadata: UserMetadata = {}
    if (dbUser.metadata && typeof dbUser.metadata === 'string') {
      try {
        metadata = JSON.parse(dbUser.metadata)
      } catch (e) {
        console.error('Failed to parse user metadata:', e)
      }
    }
    
    // Show guide only if user hasn't seen it before
    if (!metadata.hasSeenHowToStart) {
      setShowHowToStart(true)
      // Mark as seen
      await markHowToStartAsSeen(dbUser.id, metadata)
    }
  }

  const markHowToStartAsSeen = async (userId: string, existingMetadata: any) => {
    try {
      const updatedMetadata = {
        ...existingMetadata,
        hasSeenHowToStart: true,
        firstVisitDate: new Date().toISOString()
      }
      
      await withRateLimit(() => db.db.users.update(userId, {
        metadata: JSON.stringify(updatedMetadata)
      }), { maxRetries: 3, initialDelayMs: 100 })
    } catch (error) {
      console.error('Failed to update user metadata:', error)
    }
  }

  const loadBoards = async (isRetry = false): Promise<void> => {
    try {
      setError(null)
      
      console.log('[HomePage] Loading boards...', { isRetry })
      
      // Fetch ALL boards (not just user's boards) - use publicDb for global reads
      const allBoardsRaw = await requestCache.getOrFetch<any[]>(
        'global-top-boards',
        () => withRateLimit(() => publicDb.db.boards.list({
          orderBy: { totalPow: 'desc' },
          limit: 20,
          select: ['id', 'name', 'slug', 'description', 'totalPow', 'expired']
        }), { maxRetries: 5, initialDelayMs: 200, timeoutMs: 20000 }),
        isRetry ? 0 : 30000 
      )
      
      console.log('[HomePage] Boards fetched:', { count: allBoardsRaw?.length, boards: allBoardsRaw })
      
      // Filter expired boards in memory - handles 0, '0', null, undefined, false
      const allBoards = (allBoardsRaw || [])
        .filter(b => String(b.expired) !== '1')
        .slice(0, 10)
      
      console.log('[HomePage] Boards after filtering:', { count: allBoards.length })
      
      if (allBoards && allBoards.length > 0) {
        setBoards(allBoards)
      } else if (!isRetry) {
        // If empty, try one more time without cache after a short delay
        console.log('[HomePage] No boards found, retrying without cache...')
        requestCache.invalidate('global-top-boards')
        // Wait for retry to complete before resolving
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await loadBoards(true)
      } else {
        console.log('[HomePage] No boards found after retry')
        setBoards([])
      }
    } catch (err: any) {
      // Only log and show error for non-transient errors
      if (!isTransientError(err)) {
        console.error('Failed to load boards:', err)
        setError('Failed to load boards. Please check your connection.')
      }
      // Keep existing boards on transient error - will retry automatically
    }
  }

  const loadOnlineUsers = async () => {
    try {
      console.log('[HomePage] Loading online users...')
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      // Fetch ALL active users, not just current user
      const active = await requestCache.getOrFetch<any[]>(
        'homepage-online-users',
        () => withRateLimit(() => publicDb.db.chatActivity.list({
          orderBy: { lastActivity: 'desc' },
          limit: 50
        }), { maxRetries: 5, initialDelayMs: 300 }),
        10000 // 10 second cache
      )
      console.log('[HomePage] Chat activity fetched:', { count: active?.length })
      // Filter to only users active in last 2 minutes
      const recentlyActive = (active || []).filter(u => 
        u.lastActivity && new Date(u.lastActivity).toISOString() > twoMinutesAgo
      )
      console.log('[HomePage] Recently active users:', { count: recentlyActive.length })
      setOnlineUsers(recentlyActive)
    } catch (error: any) {
      // Silently handle rate limit errors - cache will retry automatically
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load online users:', error)
      }
      // Keep existing data on error instead of clearing
    }
  }

  const loadNewestUser = async () => {
    try {
      // Fetch more users and sort client-side to ensure accuracy
      const users = await requestCache.getOrFetch<any[]>(
        'homepage-newest-user',
        () => withRateLimit(() => publicDb.db.users.list({
          orderBy: { createdAt: 'desc' },
          limit: 5
        }), { maxRetries: 5, initialDelayMs: 300, timeoutMs: 45000 }),
        30000 // 30 second cache - user registration is infrequent, safe to cache longer
      )
      
      if (users && users.length > 0) {
        // Sort by createdAt descending to ensure newest is first
        const sorted = users.sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt).getTime()
          const timeB = new Date(b.createdAt).getTime()
          return timeB - timeA // Newest first
        })
        
        const newest = sorted[0]
        setNewestUser(newest)
      } else {
        setNewestUser(null)
      }
    } catch (error: any) {
      // Silently handle rate limit errors
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load newest user:', error)
      }
      // Keep existing data on error
    }
  }

  const loadTotalUsers = async () => {
    try {
      console.log('[HomePage] Loading total users count...')
      // Fetch actual total user count from DB
      const count = await requestCache.getOrFetch<number>(
        'homepage-total-users',
        () => withRateLimit(() => publicDb.db.users.count(), { maxRetries: 3, initialDelayMs: 300, timeoutMs: 20000 }),
        300000 // Cache for 5 minutes
      )
      console.log('[HomePage] Total users count:', count)
      setTotalUsers(typeof count === 'number' ? count : 0)
    } catch (error: any) {
      // Keep existing data on transient errors (timeouts, rate limits, flaky network)
      if (!isTransientError(error)) {
        console.error('Failed to load total users:', error)
      }
    }
  }

  // Show loading state while data loads (auth handled by ProtectedRoute)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING</div>
          <div className="text-sm">Please wait...</div>
        </div>
      </div>
    )
  }

  // Show the full imageboard dashboard
  return (
    <div className="bg-background text-foreground min-h-screen font-sans">
      {/* Diagnostic Banner - Remove after debugging */}
      {(boards.length === 0 || totalUsers === 0) && (
        <div className="mb-4 p-4 border-2 border-primary/40 bg-primary/5 text-primary">
          <div className="text-xs font-bold mb-2 uppercase tracking-widest">🔍 DIAGNOSTIC INFO</div>
          <div className="text-[10px] space-y-1 font-mono">
            <div>Auth Status: {authState.isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}</div>
            <div>User ID: {dbUser?.id || 'NONE'}</div>
            <div>Boards Loaded: {boards.length}</div>
            <div>Total Users: {totalUsers}</div>
            <div>Online Users: {onlineUsers.length}</div>
            <div className="mt-2 pt-2 border-t border-primary/30">
              {boards.length === 0 && <div>⚠️ No boards found - database may be empty</div>}
              {totalUsers === 0 && <div>⚠️ No users found - database may be empty</div>}
              <div className="mt-2">
                Check browser console (F12) for detailed logs.
                Look for "[HomePage]", "[BoardsPage]", "[PostersList]" messages.
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Actions Bar - no duplicate header */}
      <div className="mb-6 hidden lg:flex flex-wrap items-center justify-between gap-3 border-b border-muted pb-3">
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">› no bots</p>
        <div className="flex gap-4">
          <Link to="/mine" className="relative group px-4 py-1 border-2 border-primary bg-background text-primary text-[12px] font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]">
            <span className="relative z-10">Start Mining</span>
            <div className="absolute -bottom-1.5 -right-1.5 w-full h-full bg-primary -z-10 group-active:-bottom-0 group-active:-right-0 transition-all" />
          </Link>
          <Link to="/chat" className="relative group px-4 py-1 border-2 border-primary bg-background text-primary text-[12px] font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]">
            <span className="relative z-10">Global Chat</span>
            <div className="absolute -bottom-1.5 -right-1.5 w-full h-full bg-primary -z-10 group-active:-bottom-0 group-active:-right-0 transition-all" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-8 space-y-6">
          <Announcements />
          
          {/* Welcome Info Box - COMPUTOCRACY (Matches Screenshot) */}
          <div className="border-4 border-primary p-6 relative overflow-hidden bg-black shadow-3d-lg min-h-[300px] flex flex-col justify-center">
            <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none">
              <Zap size={300} className="text-primary stroke-[1px]" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-5xl md:text-7xl font-black mb-2 uppercase tracking-tighter text-primary leading-none">
                COMPUTOCRACY
              </h2>
              <div className="space-y-4 max-w-xl">
                <p className="text-lg md:text-xl font-bold leading-tight text-primary uppercase tracking-tight">
                  Participation is balanced by computational investment through verification.
                </p>
                <div className="h-1 w-24 bg-primary" />
                <p className="text-xs font-medium text-primary/60 uppercase tracking-widest">
                  no bots. no free lunch. sha-256 (prefix: 21e8)
                </p>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-20 hidden md:flex">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                <div className="w-2 h-2 bg-primary" />
                Posts ranked by work
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                <div className="w-2 h-2 bg-primary" />
                Tripcodes via hashcash
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                <div className="w-2 h-2 bg-primary" />
                No ads, no tracking
              </div>
            </div>
          </div>

          {/* Boards Grid */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-4 bg-black px-2">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <LayoutGrid className="w-4 h-4" />
                boards
              </h3>
              <Link to="/boards" className="text-[10px] font-black text-accent hover:bg-accent hover:text-background px-3 py-1 border border-accent transition-all uppercase tracking-widest shadow-sm">
                [view all]
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && (
                <div className="col-span-full p-4 border-2 border-red-500 bg-red-500/10 text-red-500 text-xs font-mono text-center">
                  {error.toUpperCase()}
                </div>
              )}
              
              {boards.map((board) => (
                <Link 
                  key={board.id} 
                  to={`/board/${board.slug}`}
                  className="border-2 border-primary/20 p-4 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-3d-sm hover:border-primary/40 bg-black"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg font-black text-primary tracking-tighter uppercase">/{board.slug}/</span>
                    <div className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 bg-accent text-background uppercase tracking-widest shadow-sm">
                      <TrendingUp size={10} />
                      {Number(board.totalPow || 0).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-[10px] line-clamp-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    {board.description}
                  </p>
                </Link>
              ))}
              
              {boards.length === 0 && !loading && (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-primary/20 bg-primary/5 rounded-lg space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/30 flex items-center justify-center text-primary/40">
                      <LayoutGrid size={24} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-black uppercase tracking-wider text-primary">
                        No Boards Found
                      </div>
                      <p className="text-[10px] uppercase opacity-60 max-w-xs mx-auto leading-relaxed">
                        No active boards found. 
                        Create one to get started.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Link 
                      to="/boards/create" 
                      className="btn-haichan text-xs px-6 py-2 bg-primary text-background font-black uppercase tracking-wider shadow-lg"
                    >
                      Create Board
                    </Link>
                    
                    {(authState.user?.username === 'jcb' || Number(authState.user?.isAdmin) > 0) && (
                      <Link 
                        to="/seed" 
                        className="text-[10px] font-bold text-primary/60 hover:text-primary hover:bg-primary/10 px-4 py-2 border border-primary/20 transition-all uppercase tracking-tight"
                      >
                        System Seed
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - System Stats */}
        <div className="lg:col-span-4 space-y-6">
          {/* Site Statistics */}
          <div className="border-2 border-primary/20 p-4 bg-black border-l-4 border-primary shadow-3d-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-primary/20 pb-2 text-primary">
              <Database className="w-3 h-3" />
              system stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase opacity-60 font-bold tracking-tight">Total Registered Users</span>
                <span className="text-xs font-black">{totalUsers}</span>
              </div>
              <div className="w-full bg-primary/10 h-1.5 overflow-hidden border border-primary/10">
                <div 
                  className="bg-primary h-full transition-all duration-1000" 
                  style={{ width: `${(totalUsers / MAX_USERS) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[9px] uppercase opacity-50 mb-1 font-bold">Active Boards</div>
                  <div className="text-sm font-black text-primary">{boards.length}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase opacity-50 mb-1 font-bold">Users Online</div>
                  <div className="text-sm font-black flex items-center gap-2">
                    {onlineUsers.length}
                    {onlineUsers.length === 1 && (
                      <span className="text-[8px] px-1 bg-primary text-background uppercase font-black animate-pulse">
                        Sole User
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <HashleLeaderboard />
          
          <GlobalPoWStats />
          
          <PostersList />
        </div>
      </div>
    </div>
  )
}