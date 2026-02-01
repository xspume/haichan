import { useState, useEffect } from 'react'
import db, { publicDb } from '../../lib/db-client'
import { Trophy } from 'lucide-react'

export function HashleLeaderboard() {
  const [topScorers, setTopScorers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTopScorers()
  }, [])

  const loadTopScorers = async () => {
    try {
      const users = await publicDb.db.users.list({
        orderBy: { hashleScore: 'desc' },
        limit: 5
      })
      setTopScorers(users.filter((u: any) => Number(u.hashleScore) > 0))
    } catch (error) {
      console.error('Failed to load Hashle leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-xs text-muted-foreground">Loading...</div>
  }

  return (
    <div className="card-3d bg-background overflow-hidden border-2 border-primary/20 shadow-3d-sm">
      <div className="bg-primary text-background px-3 py-1 font-sans text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={12} />
          <span>Hashle Rankings</span>
        </div>
      </div>
      <div className="p-4">
        {topScorers.length > 0 ? (
          <div className="space-y-1 font-sans text-[10px]">
            {topScorers.map((user, i) => (
              <div key={user.id} className="flex justify-between items-center group py-0.5 border-b border-primary/5 last:border-0 hover:bg-primary/5 transition-colors px-1">
                <span className="flex items-center gap-2">
                  <span className="opacity-40 font-bold tabular-nums">0{i + 1}</span>
                  <span className="font-black group-hover:text-primary transition-colors cursor-pointer text-[hsl(var(--name))]">
                    {user.username || 'anon'}
                  </span>
                </span>
                <span className="font-black tabular-nums text-primary/80">
                  {user.hashleScore || 0} PTS
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-primary/30 text-[9px] uppercase tracking-widest italic">
            Waiting for players...
          </div>
        )}
        <div className="border-t border-primary/20 mt-3 pt-2 text-[9px] text-primary/60 uppercase tracking-widest flex justify-between items-center">
          <a href="/games" className="hover:text-primary transition-colors">[play_now]</a>
          <span className="opacity-30">V1.0</span>
        </div>
      </div>
    </div>
  )
}