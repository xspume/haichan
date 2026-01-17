import { useState, useEffect } from 'react'
import { TrendingUp, Users, Award, Zap, Activity } from 'lucide-react'
import { publicDb } from '../../lib/db-client'
import { formatBrandName } from '../../lib/utils'
import { BadgesInline } from '../../lib/badge-utils'
import { batchWithRateLimit, withRateLimit } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'
import { useRealtimeListener } from '../../hooks/use-realtime-subscription'

const CACHE_TTL = 10000 // 10 second cache for global stats (faster updates)

export function GlobalPoWStats() {
  const [stats, setStats] = useState({
    totalPoW: 0,
    totalUsers: 0,
    totalThreads: 0,
    totalPosts: 0,
    topMiners: [] as any[]
  })

  // Setup real-time listener using hook
  useRealtimeListener(
    'global-stats-updates',
    (message: any) => {
      if (message.type === 'stats-updated') {
        const { pointsAdded, userId } = message.data || message.payload || message
        
        // Optimistic update for immediate feedback
        setStats(prev => {
          const newTopMiners = [...prev.topMiners]
          
          // Update user if present in top miners
          if (userId) {
            const minerIndex = newTopMiners.findIndex(m => m.id === userId)
            if (minerIndex >= 0) {
              newTopMiners[minerIndex] = {
                ...newTopMiners[minerIndex],
                totalPowPoints: (Number(newTopMiners[minerIndex].totalPowPoints) || 0) + pointsAdded
              }
              // Re-sort top miners
              newTopMiners.sort((a, b) => Number(b.totalPowPoints) - Number(a.totalPowPoints))
            }
          }
          
          return {
            ...prev,
            totalPoW: prev.totalPoW + (pointsAdded || 0),
            topMiners: newTopMiners
          }
        })

        // Invalidate cache but delay full reload to prevent flickering/rate-limiting
        requestCache.invalidatePattern(/global-stats-/)
      } else if (message.type === 'pow-submitted' || message.type === 'user-registered') {
        requestCache.invalidatePattern(/global-stats-/)
        loadStats()
      }
    }
  )

  useEffect(() => {
    loadStats()

    // Polling fallback for when realtime is unavailable (e.g. strict firewall or guest users)
    const interval = setInterval(() => {
      // We rely on CACHE_TTL to prevent spamming, but this ensures we fetch fresh data periodically
      loadStats()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      console.log('[GlobalStats] Loading stats...')
      
      const results = await Promise.allSettled([
        requestCache.getOrFetch(
          'global-stats-top-miners',
          () => withRateLimit(
            () => publicDb.db.users.list({ 
              limit: 5, 
              orderBy: { totalPowPoints: 'desc' },
              where: { totalPowPoints: { '>': 0 } }
            }),
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          CACHE_TTL
        ),
        
        requestCache.getOrFetch(
          'global-stats-user-count',
          () => withRateLimit(
            () => publicDb.db.users.count(),
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          60000 // Cache count longer
        ),

        requestCache.getOrFetch(
          'global-stats-thread-count',
          () => withRateLimit(
            () => publicDb.db.threads.count(),
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          30000
        ),
        
        requestCache.getOrFetch(
          'global-stats-post-count',
          () => withRateLimit(
            () => publicDb.db.posts.count(),
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          30000
        ),

        requestCache.getOrFetch(
          'global-stats-total-pow',
          async () => {
            // If we can't get a sum directly, we might need a better way
            // For now, let's get top 100 users and sum them up as an estimate or just use a known stat
            // INCREASED LIMIT to 200 for better accuracy
            const topUsers = await withRateLimit(
              () => publicDb.db.users.list({ 
                limit: 200, 
                orderBy: { totalPowPoints: 'desc' },
                select: ['totalPowPoints'],
                where: { totalPowPoints: { '>': 0 } }
              }),
              { maxRetries: 5, initialDelayMs: 300 }
            ) as any[];
            const sum = topUsers.reduce((sum: number, u: any) => sum + (Number(u.totalPowPoints) || 0), 0);
            
            // If we found users but sum is 0, something is wrong with data types
            if (topUsers.length > 0 && sum === 0) {
              console.warn('[GlobalStats] Summed top users but got 0. Check data types:', topUsers[0]);
            }
            
            return sum;
          },
          CACHE_TTL
        )
      ])

      const topMiners = results[0].status === 'fulfilled' ? (results[0].value as any[]) : []
      const totalUsers = results[1].status === 'fulfilled' ? (results[1].value as number) : 0
      const totalThreads = results[2].status === 'fulfilled' ? (results[2].value as number) : 0
      const totalPosts = results[3].status === 'fulfilled' ? (results[3].value as number) : 0
      const totalPoW = results[4].status === 'fulfilled' ? (results[4].value as number) : 0

      setStats({
        totalPoW,
        totalUsers: Number(totalUsers) || 0,
        totalThreads: Number(totalThreads) || 0,
        totalPosts: Number(totalPosts) || 0,
        topMiners
      })
    } catch (error: any) {
      // Silently handle rate limit errors - keep existing data
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load stats:', error)
      }
    }
  }

  return (
    <div className="card-3d bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-background px-3 py-1 font-mono text-[10px] font-bold uppercase flex items-center justify-between">
        <span>Global Statistics</span>
        <Activity className="w-3 h-3" />
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
          <div className="border border-primary/20 bg-primary/5 p-2 space-y-1">
            <div className="flex items-center gap-1 opacity-60">
              <TrendingUp className="w-2.5 h-2.5" />
              <span className="uppercase font-bold">Total Work</span>
            </div>
            <div className="text-base font-black tracking-tighter text-primary">{stats.totalPoW.toLocaleString()}</div>
          </div>

          <div className="border border-primary/20 bg-primary/5 p-2 space-y-1">
            <div className="flex items-center gap-1 opacity-60">
              <Users className="w-2.5 h-2.5" />
              <span className="uppercase font-bold">Total Users</span>
            </div>
            <div className="text-base font-black tracking-tighter text-primary">{stats.totalUsers}</div>
          </div>

          <div className="border border-primary/20 bg-primary/5 p-2 space-y-1">
            <div className="flex items-center gap-1 opacity-60">
              <Zap className="w-2.5 h-2.5" />
              <span className="uppercase font-bold">Threads</span>
            </div>
            <div className="text-base font-black tracking-tighter text-primary">{stats.totalThreads}</div>
          </div>

          <div className="border border-primary/20 bg-primary/5 p-2 space-y-1">
            <div className="flex items-center gap-1 opacity-60">
              <Award className="w-2.5 h-2.5" />
              <span className="uppercase font-bold">Posts</span>
            </div>
            <div className="text-base font-black tracking-tighter text-primary">{stats.totalPosts}</div>
          </div>
        </div>

        {/* Top Miners */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold text-primary opacity-60 border-b border-primary/20 pb-1">
            Top Contributors
          </div>
          <div className="space-y-1 font-mono text-[10px]">
            {stats.topMiners.map((miner, index) => (
              <div key={miner.id} className="flex items-center justify-between group py-0.5">
                <span className="flex items-center gap-2">
                  <span className="opacity-40">{index + 1}</span>
                  <span className="font-bold group-hover:text-primary transition-colors cursor-pointer">
                    {formatBrandName(miner.username) || 'Anonymous'}
                  </span>
                  <BadgesInline user={miner} className="scale-75" />
                </span>
                <span className="font-bold tabular-nums text-primary/80">{Number(miner.totalPowPoints || 0).toLocaleString()}</span>
              </div>
            ))}
            {stats.topMiners.length === 0 && (
              <div className="text-center text-primary/30 py-2 text-[9px] uppercase italic">
                Updating statistics...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}