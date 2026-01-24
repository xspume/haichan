import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import { publicDb } from '../../lib/db-client'
import { formatBrandName } from '../../lib/utils'
import { BadgesInline } from '../../lib/badge-utils'
import { withRateLimit, isTransientError } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'
import { useRealtimeListener } from '../../hooks/use-realtime-subscription'

interface Poster {
  id: string
  username: string
  totalPowPoints: number
  diamondLevel: number
  threadCount?: number
  postCount?: number
}

const CACHE_TTL = 30000 // 30 second cache for posters list

export function PostersList() {
  const [posters, setPosters] = useState<Poster[]>([])
  const [loading, setLoading] = useState(true)

  // Load initial posters on mount
  useEffect(() => {
    loadPosters()
  }, [])

  // Setup real-time subscription for instant updates
  // Using shared hook prevents duplicate subscriptions when multiple components listen to same channel
  useRealtimeListener(
    'posters-updates',
    (message: any) => {
      if (message.type === 'poster-activity' || message.type === 'post-created' || message.type === 'thread-created') {
        // Invalidate cache and reload instantly
        requestCache.invalidate('posters-list-users')
        loadPosters()
      }
    },
    ['poster-activity', 'post-created', 'thread-created']
  )

  // Also listen for PoW updates to update scores live
  useRealtimeListener(
    'global-stats-updates',
    (message: any) => {
      if (message.type === 'stats-updated') {
        const { userId, pointsAdded } = message.payload || message
        
        if (userId) {
          setPosters(prevPosters => {
            const updated = prevPosters.map(poster => 
              poster.id === userId
                ? { ...poster, totalPowPoints: (poster.totalPowPoints || 0) + pointsAdded }
                : poster
            )
            // Re-sort if scores changed
            return updated.sort((a, b) => b.totalPowPoints - a.totalPowPoints)
          })
        }
      }
    },
    []
  )

  const loadPosters = async () => {
    try {
      console.log('[PostersList] Loading posters...')
      // Get all users with PoW points, sorted by highest first
      const users = await requestCache.getOrFetch<any[]>(
        'posters-list-users',
        () => withRateLimit(
          () => publicDb.db.users.list({
            orderBy: { totalPowPoints: 'desc' },
            limit: 20
          }),
          { maxRetries: 5, initialDelayMs: 300, timeoutMs: 45000 }
        ),
        CACHE_TTL
      )

      console.log('[PostersList] Users fetched:', { count: users?.length, users })

      if (!users || users.length === 0) {
        console.log('[PostersList] No users found')
        setPosters([])
        return
      }

      const activePostersList = users.map(user => ({
        id: user.id,
        username: user.username || user.displayName || 'Anonymous',
        totalPowPoints: Number(user.totalPowPoints) || 0,
        diamondLevel: Number(user.diamondLevel) || 0
      }))

      console.log('[PostersList] Posters processed:', { count: activePostersList.length })
      setPosters(activePostersList)
    } catch (error: any) {
      // Keep existing data on transient errors (timeouts, rate limits, flaky network)
      if (!isTransientError(error)) {
        console.error('Failed to load posters:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card-3d bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-background px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3" />
          <span>Recently Active Posters</span>
        </div>
      </div>

      {/* Posters List */}
      <div className="p-4 space-y-1 font-mono text-[10px]">
        {loading ? (
          <div className="text-center text-primary/30 py-4 text-[9px] uppercase tracking-widest italic animate-pulse">
            Loading poster list...
          </div>
        ) : posters.length > 0 ? (
          posters.map((poster, index) => (
            <div key={poster.id} className="flex items-center justify-between group py-0.5 px-1 hover:bg-primary/5 transition-colors">
              <span className="flex items-center gap-2">
                <span className="opacity-40 tabular-nums">0{index + 1}</span>
                <span className="font-bold group-hover:text-primary transition-colors cursor-pointer truncate max-w-[100px]">
                  {formatBrandName(poster.username)}
                </span>
                <BadgesInline user={poster} className="scale-75" />
              </span>
              <span className="font-bold tabular-nums text-primary/80">
                {Number(poster.totalPowPoints).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="text-center text-primary/30 py-4 text-[9px] uppercase tracking-widest italic">
            No active posters found
          </div>
        )}
      </div>
    </div>
  )
}
