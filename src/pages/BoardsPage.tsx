import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
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
      // Fetch ALL boards (not just current user's boards) - this is the directory
      const allBoardsRaw = await requestCache.getOrFetch<any[]>(
        'page-boards',
        () => withRateLimit(() => publicDb.db.boards.list({
          // IMPORTANT: directory should not default to a small page size.
          limit: 200,
          orderBy: { total_pow: 'desc' }
        }), { maxRetries: 5, initialDelayMs: 300, timeoutMs: 20000 }),
        isRetry ? 0 : 5000 
      )
      
      // Filter expired boards in memory to be safer with types
      const allBoards = (allBoardsRaw || []).filter(b => String(b.expired) !== '1');
      
      if (allBoards && allBoards.length > 0) {
        setBoards(allBoards)
        setLoading(false)
      } else if (!isRetry) {
        requestCache.invalidate('page-boards')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await loadBoards(true)
      } else {
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
    <div className="bg-background text-foreground min-h-screen font-mono">
      <div className="container mx-auto p-3 max-w-7xl">
        <div className="mb-6 border-b-2 border-primary pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              Boards
            </h1>
            <p className="text-[10px] uppercase tracking-wider opacity-60 mt-1">
              Active boards ranked by cumulative work.
            </p>
          </div>
          <Link to="/boards/create" className="btn-3d text-xs px-4 py-2 bg-primary text-background font-bold uppercase tracking-wider">
            Create Board
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2 space-y-3">
            {/* Boards Section - 4chan style */}
            <div className="border border-foreground">
              <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                Boards List
              </div>
              <div className="p-3">
                {error && (
                  <div className="p-3 mb-3 border-2 border-red-500 bg-red-500/10 text-red-500 text-[10px] font-mono text-center uppercase font-bold">
                    Error: {error}
                  </div>
                )}
                
                {boards.length > 0 ? (
                  <div className="space-y-2">
                    {boards.map((board) => (
                      <div key={board.id} className="border-b border-foreground/30 pb-2 last:border-0">
                        <div className="flex items-baseline gap-2">
                          <Link
                            to={`/board/${board.slug}`}
                            className="font-bold text-sm hover:underline"
                          >
                            /{board.slug}/
                          </Link>
                          <span className="text-xs text-muted-foreground flex-1">
                            {board.description || 'No description'}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {(board.totalPow ?? board.total_pow ?? 0)} PoW
                          </span>
                          <button
                            onClick={() => setSelectedBoardForMining(board.id)}
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 border border-foreground transition-colors ${
                              selectedBoardForMining === board.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-transparent hover:bg-muted'
                            }`}
                          >
                            MINE
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
