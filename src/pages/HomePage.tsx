import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Database, Lock, Trophy, MessageSquare, BookOpen, Sparkles, TrendingUp, LayoutGrid } from 'lucide-react'
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
    // Load data on mount (auth is guaranteed by ProtectedRoute)
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
      
      // Filter expired boards in memory - handles 0, '0', null, undefined, false
      const allBoards = (allBoardsRaw || [])
        .filter(b => String(b.expired) !== '1')
        .slice(0, 10)
      
      if (allBoards && allBoards.length > 0) {
        setBoards(allBoards)
      } else if (!isRetry) {
        // If empty, try one more time without cache after a short delay
        requestCache.invalidate('global-top-boards')
        // Wait for retry to complete before resolving
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await loadBoards(true)
      } else {
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
      // Filter to only users active in last 2 minutes
      const recentlyActive = (active || []).filter(u => 
        u.lastActivity && new Date(u.lastActivity).toISOString() > twoMinutesAgo
      )
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
      // Fetch actual total user count from DB
      const count = await requestCache.getOrFetch<number>(
        'homepage-total-users',
        () => withRateLimit(() => publicDb.db.users.count(), { maxRetries: 3, initialDelayMs: 300, timeoutMs: 20000 }),
        300000 // Cache for 5 minutes
      )
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
    <div className="bg-background text-foreground min-h-screen font-mono">
      {/* Quick Actions Bar - no duplicate header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
        <p className="text-[10px] uppercase tracking-wider opacity-60">Secure Imageboard</p>
        <div className="flex gap-2">
          <Link to="/mine" className="btn-3d text-[10px] px-3 py-1">
            Start Mining
          </Link>
          <Link to="/chat" className="btn-3d text-[10px] px-3 py-1">
            Global Chat
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-8 space-y-6">
          <Announcements />
          
          {/* Welcome Info Box */}
          <div className="card-3d p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Zap size={120} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-4 uppercase tracking-wider text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Community Meritocracy
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-primary/80">
                  Haichan is an imageboard where participation is balanced by computational effort. 
                  We prioritize quality and commitment through verification.
                </p>
                <div className="p-3 bg-primary/5 border border-primary/20">
                  <div className="text-[10px] uppercase font-bold text-primary mb-1">Hashing Protocol</div>
                  <div className="text-xs font-bold font-mono">SHA-256 (PREFIX: 21e8)</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 bg-primary" />
                  <span className="font-bold">MERIT-BASED RANKING</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 bg-primary" />
                  <span className="font-bold">VERIFIED REPUTATION</span>
                </div>

              </div>
            </div>
          </div>

          {/* Boards Grid */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-4 bg-primary/5 px-2">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                Index of Boards
              </h3>
              <Link to="/boards" className="text-[10px] font-bold text-primary hover:bg-primary hover:text-background px-2 py-0.5 border border-primary transition-all uppercase tracking-tight">
                View Directory
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
                  className="card-3d p-4 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg font-black text-primary tracking-tighter">/{board.slug}/</span>
                    <div className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-primary text-background uppercase">
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
                      className="btn-3d text-xs px-6 py-2 bg-primary text-background font-black uppercase tracking-wider"
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
          <div className="card-3d p-4 bg-primary/5">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-primary/20 pb-2">
              <Database className="w-3 h-3" />
              Site Statistics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase opacity-60 font-bold">Total Registered Users</span>
                <span className="text-xs font-black">{totalUsers}</span>
              </div>
              <div className="w-full bg-primary/10 h-1.5 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-1000" 
                  style={{ width: `${(totalUsers / MAX_USERS) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[9px] uppercase opacity-50 mb-1">Active Boards</div>
                  <div className="text-sm font-black">{boards.length}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase opacity-50 mb-1">Users Currently Online</div>
                  <div className="text-sm font-black flex items-center gap-2">
                    {onlineUsers.length}
                    {onlineUsers.length === 1 && (
                      <span className="text-[8px] px-1 bg-primary/10 text-primary uppercase font-bold animate-pulse">
                        Sole User
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <GlobalPoWStats />
          <HashleLeaderboard />
          <PostersList />
        </div>
      </div>
    </div>
  )
}
