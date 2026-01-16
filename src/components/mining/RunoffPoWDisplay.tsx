import { useState, useEffect } from 'react'
import { Trophy, Zap, Award, Activity } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'

interface RunoffStats {
  totalPoW: number
  recentPoW: number
  diamondLevel: number
}

export function RunoffPoWDisplay() {
  const { authState } = useAuth()
  const [stats, setStats] = useState<RunoffStats>({
    totalPoW: 0,
    recentPoW: 0,
    diamondLevel: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats(false)
    // Refresh stats every 10 seconds
    const interval = setInterval(() => loadStats(true), 10000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async (isPolling: boolean = false) => {
    try {
      const user = authState.user
      if (!user?.id) return

      // Get user's total PoW points and diamond level
      const users = await db.db.users.list({
        where: { id: user.id },
        limit: 1
      })

      if (users.length > 0) {
        const userData = users[0]
        
        // Get recent PoW (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentPow = await db.db.powRecords.list({
          where: {
            userId: user.id,
            createdAt: { '>': yesterday }
          }
        })

        const recentTotal = recentPow.reduce((sum, record) => {
          return sum + (Number(record.points) || 0)
        }, 0)

        setStats({
          totalPoW: Number(userData.totalPowPoints) || 0,
          recentPoW: recentTotal,
          diamondLevel: Number(userData.diamondLevel) || 0
        })
      }
    } catch (error) {
      // Only log errors on initial load, silently ignore polling failures
      // Network errors during polling are expected (e.g., temporary connectivity issues)
      if (!isPolling) {
        console.error('Failed to load runoff PoW stats:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="card-3d bg-background overflow-hidden">
      <div className="bg-primary text-background px-4 py-2 font-bold uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span>Extraction Metrics</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3 font-mono">
          {/* Total PoW */}
          <div className="border border-primary/20 bg-primary/5 p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 opacity-60">
              <Trophy className="w-2.5 h-2.5" />
              <div className="text-[8px] uppercase font-bold tracking-widest">Aggregate</div>
            </div>
            <div className="text-lg font-black text-primary tracking-tighter">
              {stats.totalPoW.toLocaleString()}
            </div>
            <div className="text-[8px] opacity-40 uppercase">Total Proof</div>
          </div>

          {/* Recent PoW (24h) */}
          <div className="border border-primary/20 bg-primary/5 p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 opacity-60">
              <Activity className="w-2.5 h-2.5" />
              <div className="text-[8px] uppercase font-bold tracking-widest">Pulse</div>
            </div>
            <div className="text-lg font-black text-primary tracking-tighter">
              {stats.recentPoW > 0 ? `+${stats.recentPoW.toLocaleString()}` : '0'}
            </div>
            <div className="text-[8px] opacity-40 uppercase">24H Window</div>
          </div>

          {/* Diamond Level */}
          <div className="border border-primary/20 bg-primary/5 p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 opacity-60">
              <Award className="w-2.5 h-2.5" />
              <div className="text-[8px] uppercase font-bold tracking-widest">Rank</div>
            </div>
            <div className="text-lg font-black text-primary tracking-tighter">
              {stats.diamondLevel > 0 ? `LVL ${stats.diamondLevel}` : 'BASE'}
            </div>
            <div className="text-[8px] opacity-40 uppercase">Reputation</div>
          </div>
        </div>

        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/20 text-[9px] text-primary/60 uppercase tracking-widest italic">
            Runoff mining actively syncing to node...
          </div>
        </div>
      </div>
    </div>
  )
}
