import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { publicDb } from '../../lib/db-client'
import { requestCache } from '../../lib/request-cache'
import { withRateLimit, isTransientError } from '../../lib/rate-limit-utils'
import { subscribeToChannel } from '../../lib/realtime-manager'

export function BoardsToolbar() {
  const [boards, setBoards] = useState<any[]>([])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    const initializeData = async () => {
      await loadBoards()
      
      unsubscribe = await subscribeToChannel(
        'boards-updates',
        'boards-toolbar',
        (message: any) => {
          if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
            requestCache.invalidate('global-top-boards')
            loadBoards()
          }
        }
      )
    }
    
    initializeData()
    
    return () => {
      unsubscribe?.()
    }
  }, [])

  const loadBoards = async (isRetry = false): Promise<void> => {
    try {
      // Fetch all boards and filter in memory to handle various expired formats (0, '0', null, etc.)
      const allBoardsRaw = await requestCache.getOrFetch<any[]>(
        'global-top-boards',
        () => withRateLimit(
          () => publicDb.db.boards.list({
            // Toolbar should act like a quick directory, not just a "top boards" list.
            // Sort by slug for predictability.
            orderBy: { slug: 'asc' },
            limit: 120,
            select: ['id', 'slug', 'name', 'expired']
          }),
          { maxRetries: 5, initialDelayMs: 200, timeoutMs: 20000 }
        ),
        isRetry ? 0 : 30000
      )
      
      // Filter expired boards in memory - handles 0, '0', null, undefined, false
      const allBoards = (allBoardsRaw || [])
        .filter(b => String(b.expired) !== '1')
      
      if (allBoards && allBoards.length > 0) {
        setBoards(allBoards)
      } else if (!isRetry) {
        requestCache.invalidate('global-top-boards')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await loadBoards(true)
      } else {
        setBoards([])
      }
    } catch (error: any) {
      // Only log non-transient errors - toolbar is non-critical
      if (!isTransientError(error)) {
        console.error('Failed to load boards:', error)
      }
      // Keep boards as empty on error - avoid crashes
      if (!boards.length) {
        setBoards([])
      }
    }
  }

  return (
    <div className="flex items-center gap-1 text-[11px] font-mono border-x border-primary/20 px-3 h-8 bg-primary/5 overflow-x-auto whitespace-nowrap custom-scrollbar">
      <span className="text-primary/60 font-bold uppercase tracking-tighter mr-1">boards:</span>
      {boards.map((board, index) => (
        <span key={board.id} className="flex items-center">
          <Link 
            to={`/board/${board.slug}`}
            className="hover:underline hover:text-primary transition-colors px-1 text-primary font-bold"
            title={board.name}
          >
            {board.slug}
          </Link>
          {index < boards.length - 1 && <span className="text-muted-foreground/30">/</span>}
        </span>
      ))}
      
      <Link to="/boards" className="ml-2 hover:underline text-[10px] text-primary/60 uppercase font-bold tracking-tighter">
        View All
      </Link>
    </div>
  )
}
