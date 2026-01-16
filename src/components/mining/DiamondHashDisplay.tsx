import { useEffect, useState, useRef } from 'react'
import { Award, Crown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'
import { requestCache } from '../../lib/request-cache'
import type { RealtimeChannel } from '@blinkdotnew/sdk'
import { cn } from '../../lib/utils'

interface Achievement {
  level: number
  hash: string
  achievedAt: string
}

export function DiamondHashDisplay() {
  const { authState } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!user?.id) return

    let channel: RealtimeChannel | null = null
    let isMounted = true

    const initRealtime = async () => {
      try {
        // Subscribe to mining updates channel
        channel = db.realtime.channel('mining-updates')
        await channel.subscribe({ userId: user.id })

        if (!isMounted) {
          channel?.unsubscribe()
          return
        }

        // Listen for mining completion events
        channel.onMessage((message) => {
          if (isMounted && message.type === 'mining-complete' && message.userId === user.id) {
            console.log('Mining completion received via realtime:', message.data)
            // Reload user data when mining completes
            loadUserData()
          }
        })

        channelRef.current = channel
      } catch (error: any) {
        // Handle subscription timeout gracefully - realtime is non-critical
        if (error?.name === 'BlinkRealtimeError' && error?.message?.includes('timeout')) {
          console.warn('Mining updates realtime subscription timeout (non-critical)')
        } else {
          console.warn('Mining updates realtime subscription failed (non-critical):', error?.message || error)
        }
      }
    }

    initRealtime()

    return () => {
      isMounted = false
      channel?.unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const currentUser = authState.user
      if (currentUser) {
        setUser(currentUser)
        
        // Cache achievements with 30s TTL
        const userAchievements = await requestCache.getOrFetch(
          `achievements-${currentUser.id}`,
          () => db.db.achievements.list({
            where: { userId: currentUser.id },
            orderBy: { level: 'desc' }
          }),
          30000
        )
        
        setAchievements(userAchievements as any)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const getLevelColor = (level: number) => {
    if (level >= 60) return 'text-amber-500 animate-pulse' // Legendary/Max
    if (level >= 50) return 'text-red-600'
    if (level >= 40) return 'text-orange-600'
    if (level >= 30) return 'text-pink-500'
    if (level >= 20) return 'text-cyan-500'
    if (level >= 10) return 'text-purple-500'
    if (level >= 6) return 'text-blue-500'
    if (level >= 4) return 'text-green-500'
    if (level >= 2) return 'text-yellow-500'
    return 'text-gray-500'
  }

  return (
    <div className="card-3d bg-background overflow-hidden">
      <div className="bg-primary text-background px-4 py-2 font-bold uppercase tracking-widest flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5" />
          <span>Diamond Identity</span>
        </div>
      </div>

      <div className="p-6">
        {user?.bitcoinAddress && (
          <div className="mb-8 p-4 border-2 border-primary/30 bg-primary/5 rounded-none font-mono">
            <div className="text-[10px] uppercase tracking-widest text-primary/60 mb-2 font-bold flex items-center justify-between">
              <span>Primary Node Address</span>
              <span className="text-green-500 animate-pulse text-[8px]">● IDENTITY_VERIFIED</span>
            </div>
            <div className="text-sm font-black text-primary break-all selection:bg-primary selection:text-background">
              {user.bitcoinAddress}
            </div>
            <div className="mt-2 text-[9px] text-primary/40 uppercase tracking-tighter">
              Legacy P2PKH Protocol • 1-Address Identity
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-primary/60 mb-3 font-bold">Cryptographic Precision Levels</div>
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: 60 }, (_, i) => {
              const level = i + 1
              const achieved = achievements.some(a => a.level === level)
              return (
                <div
                  key={level}
                  className={cn(
                    "aspect-square border flex items-center justify-center font-mono text-[10px] font-black transition-all duration-500 cursor-help",
                    achieved 
                      ? "border-primary bg-primary text-background shadow-[0px_0px_10px_rgba(0,255,0,0.3)] scale-105 z-10" 
                      : "border-primary/10 text-primary/10 bg-primary/5 hover:border-primary/30 hover:text-primary/30"
                  )}
                  title={`Level ${level}: ${level} trailing zeros`}
                >
                  {level}
                </div>
              )
            })}
          </div>
        </div>

        {achievements.length > 0 ? (
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-primary/60 mb-2 font-bold">Extracted Artifacts</div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {achievements.map((achievement) => (
                <div
                  key={achievement.level}
                  className="border border-primary/20 bg-primary/5 p-3 font-mono"
                >
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-primary/10">
                    <div className="flex items-center gap-2">
                      <Award className={cn("w-4 h-4", getLevelColor(achievement.level))} />
                      <span className="font-black text-xs">LEVEL_{achievement.level}</span>
                    </div>
                    <span className="text-[9px] font-bold text-primary/50 uppercase">
                      {achievement.level} Trailing Zeros
                    </span>
                  </div>
                  <div className="text-[10px] text-primary/70 break-all leading-tight">
                    {achievement.hash}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-primary/20 bg-primary/5">
            <div className="text-[10px] text-primary/40 uppercase tracking-[0.2em]">
              NO_DIAMOND_SIGNALS_DETECTED
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
