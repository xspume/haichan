import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, LayoutGrid } from 'lucide-react'
import { publicDb } from '../lib/db-client'
import { requestCache } from '../lib/request-cache'
import { withRateLimit, isTransientError } from '../lib/rate-limit-utils'
import { ChatView } from '../components/views/ChatView'
import { GlobalPoWStats } from '../components/views/GlobalPoWStats'
import { BlogView } from '../components/views/BlogView'
import { BoardMiningWidget } from '../components/views/BoardMiningWidget'
import { subscribeToChannel } from '../lib/realtime-manager'
import { useAuth } from '../contexts/AuthContext'

export function BoardsPage() {
  const { authState } = useAuth()
  const [boards, setBoards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBoardForMining, setSelectedBoardForMining] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    const initializeData = async () => {
      // Load initial boards
      await loadBoards()
      
      // Setup real-time subscription for instant updates
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribe = await subscribeToChannel(
        'boards-updates',
        'boards-page',
        (message: any) => {
          if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
            // Invalidate cache and reload instantly
            requestCache.invalidate('page-boards')
            loadBoards()
          }
        }
      )

      // Listen for global PoW stats to update board totals live
      const unsubscribePoW = await subscribeToChannel(
        'global-stats-updates',
        'boards-page-pow',
        (message: any) => {
          if (message.type === 'stats-updated') {
            const { targetType, targetId, pointsAdded } = message.payload || message
            
            if (targetType === 'board') {
              setBoards(prevBoards => 
                prevBoards.map(board => 
                  board.id === targetId 
                    ? { ...board, totalPow: (board.totalPow || 0) + pointsAdded }
                    : board
                )
              )
            }
          }
        }
      )
      
      // Chain unsubscribe
      const oldUnsubscribe = unsubscribe
      unsubscribe = () => {
        oldUnsubscribe && oldUnsubscribe()
        unsubscribePoW && unsubscribePoW()
      }
    }
    
    initializeData()
    
    // Polling fallback for boards data (30s interval)
    // Ensures board stats update even if realtime is unavailable
    const interval = setInterval(() => {
      loadBoards()
    }, 30000)
    
    return () => {
      unsubscribe?.()
      clearInterval(interval)
    }
  }, [])

  const handleMineComplete = (boardId: string, powPoints: number) => {
    // Update the board in the local state
    setBoards(boards.map(b => 
      b.id === boardId 
        ? { ...b, totalPow: (b.totalPow || 0) + powPoints }
        : b
    ))
  }

  const loadBoards = async (isRetry = false): Promise<void> => {
    try {
      setError(null)
      console.log('[BoardsPage] Loading boards...', { isRetry })
      
      // Fetch ALL boards (not just current user's boards) - this is the directory
      const allBoardsRaw = await requestCache.getOrFetch<any[]>(
        'page-boards',
        () => withRateLimit(() => publicDb.db.boards.list({
          // IMPORTANT: directory should not default to a small page size.
          // Without an explicit limit, the SDK may return only the first page (often 10).
          limit: 200,
          orderBy: { totalPow: 'desc' },
          select: ['id', 'name', 'slug', 'description', 'totalPow', 'expired']
        }), { maxRetries: 5, initialDelayMs: 300, timeoutMs: 20000 }),
        isRetry ? 0 : 5000 
      )
      
      console.log('[BoardsPage] Boards fetched:', { count: allBoardsRaw?.length, boards: allBoardsRaw })
      
      // Filter expired boards in memory to be safer with types
      const allBoards = (allBoardsRaw || []).filter(b => String(b.expired) !== '1');
      
      console.log('[BoardsPage] Boards after filtering:', { count: allBoards.length })
      
      if (allBoards && allBoards.length > 0) {
        setBoards(allBoards)
        setLoading(false)
      } else if (!isRetry) {
        console.log('[BoardsPage] No boards found, retrying...')
        requestCache.invalidate('page-boards')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await loadBoards(true)
      } else {
        console.log('[BoardsPage] No boards found after retry')
        setBoards([])
        setLoading(false)
      }
    } catch (err: any) {
      // Only log and show error for non-transient errors
      if (!isTransientError(err)) {
        console.error('Failed to load boards:', err)
        setError('Failed to load boards directory.')
      }
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING</div>
          <div className="text-gray-500">Please wait...</div>
        </div>
      </div>
    )
  }

  // Board directory is public - show boards regardless of auth state
  return (
    <div className="bg-background text-foreground min-h-screen font-sans">
      <div className="container mx-auto p-3 max-w-7xl">
        {/* Diagnostic Banner - Remove after debugging */}
        {boards.length === 0 && !loading && (
          <div className="mb-4 p-4 border-2 border-yellow-500 bg-yellow-500/10 text-yellow-500">
            <div className="text-xs font-bold mb-2">🔍 BOARDS PAGE DIAGNOSTIC</div>
            <div className="text-[10px] space-y-1 font-mono">
              <div>Auth Status: {authState.isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}</div>
              <div>Boards Loaded: {boards.length}</div>
              <div>Error: {error || 'NONE'}</div>
              <div className="mt-2 pt-2 border-t border-yellow-500/30">
                <div>⚠️ No boards found - database may be empty or query is failing</div>
                <div className="mt-2">
                  Check browser console (F12) for "[BoardsPage]" logs
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-6 border-b-2 border-primary pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3 text-primary">
              <TrendingUp className="w-8 h-8 text-primary" />
              Boards
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-60 mt-1">
              Active boards ranked by cumulative work.
            </p>
          </div>
          <Link to="/boards/create" className="btn-haichan text-xs px-6 py-2 uppercase font-black tracking-widest shadow-lg">
            Create Board
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2 space-y-3">
            {/* Boards Section - 4chan style */}
            <div className="border-2 border-primary/20 shadow-3d-sm bg-card/30 overflow-hidden">
              <div className="border-b-2 border-primary/20 bg-primary/10 px-3 py-1.5 font-black text-[10px] uppercase tracking-widest text-primary flex items-center gap-2">
                <LayoutGrid className="w-3 h-3" />
                Boards Directory
              </div>
              <div className="p-4">
                {error && (
                  <div className="p-3 mb-3 border-2 border-destructive/40 bg-destructive/10 text-destructive text-[10px] font-black text-center uppercase tracking-widest">
                    Error: {error}
                  </div>
                )}
                
                {boards.length > 0 ? (
                  <div className="space-y-3">
                    {boards.map((board) => (
                      <div key={board.id} className="border-b border-primary/5 pb-3 last:border-0 hover:bg-primary/5 transition-colors px-2 -mx-2">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/board/${board.slug}`}
                            className="font-black text-lg text-primary tracking-tighter hover:underline min-w-[60px]"
                          >
                            /{board.slug}/
                          </Link>
                          <span className="text-xs text-foreground/70 flex-1 line-clamp-1 font-medium italic">
                            {board.description || 'No description'}
                          </span>
                          <span className="text-[10px] text-primary/60 whitespace-nowrap font-black uppercase tracking-tighter">
                            {board.totalPow || 0} PoW
                          </span>
                          <button
                            onClick={() => setSelectedBoardForMining(board.id)}
                            className={`text-[10px] font-black uppercase px-3 py-1 border-2 transition-all shadow-sm ${
                              selectedBoardForMining === board.id
                                ? 'bg-primary text-background border-primary'
                                : 'bg-background text-primary border-primary/20 hover:border-primary hover:bg-primary/10'
                            }`}
                          >
                            {selectedBoardForMining === board.id ? 'ACTIVE' : 'MINE'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-6">
                    <div className="space-y-2">
                      <div className="text-sm uppercase font-bold tracking-wider text-primary">
                        Directory
                      </div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        The index is empty
                      </div>
                    </div>
                    <div className="border-t border-b border-foreground/20 py-4 mx-auto max-w-xs">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-relaxed">
                        No active boards found.<br />
                        Create one to get started.
                      </p>
                    </div>
                    <Link 
                      to="/boards/create" 
                      className="inline-block text-xs font-bold text-primary hover:bg-primary hover:text-background px-4 py-2 border-2 border-primary transition-all uppercase tracking-wide"
                    >
                      Create Board
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <BlogView />
          </div>

          {/* Right Column - Mining, Chat & Stats */}
          <div className="space-y-3">
            {/* Board Mining Widget */}
            {selectedBoardForMining ? (
              boards.find(b => b.id === selectedBoardForMining) && (
                <BoardMiningWidget 
                  board={boards.find(b => b.id === selectedBoardForMining)!}
                  onMineComplete={(powPoints) => {
                    handleMineComplete(selectedBoardForMining, powPoints)
                  }}
                />
              )
            ) : (
              <div className="border border-foreground p-3 bg-muted">
                <p className="font-mono text-xs text-muted-foreground text-center">Select a board to mine PoW</p>
              </div>
            )}
            
            <GlobalPoWStats />
            <ChatView />
          </div>
        </div>
      </div>
    </div>
  )
}
