import { useState, useEffect } from 'react'
import { Zap, Users, Clock, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { publicDb } from '../../lib/db-client'
import { MiningManager } from '../../lib/mining/MiningManager'
import { requestCache } from '../../lib/request-cache'
import { cn } from '../../lib/utils'

export function BottomToolbar() {
  const [stats, setStats] = useState({
    currentHashRate: 0,
    bestHash: '',
    onlineUsers: 0,
    globalPoW: 0,
    sessionPoints: 0,
    sessionTime: 0,
    miningMode: 'idle'
  })

  useEffect(() => {
    let startTime = Date.now()
    
    // Fetch user stats with cache (10 second TTL)
    // Track consecutive network failures to reduce log noise
    let consecutiveFailures = 0
    const MAX_SILENT_FAILURES = 3
    
    const fetchUserStats = async () => {
      try {
        // Use requestCache with 10s TTL
        // Note: We fetch all users for global PoW calculation, but could be optimized
        const users = await requestCache.getOrFetch<any[]>(
          'users-stats',
          () => publicDb.db.users.list({ limit: 100 }),
          10000
        )
        // Reset failure counter on success
        consecutiveFailures = 0
        return users || []
      } catch (error: any) {
        consecutiveFailures++
        // Only log after multiple consecutive failures to reduce noise
        // Network errors are common during page transitions
        if (consecutiveFailures > MAX_SILENT_FAILURES) {
          console.warn('[BottomToolbar] User stats fetch failed (will retry):', error?.message || 'Network error')
        }
        // Return empty array if fetch fails
        return []
      }
    }
    
    const updateStats = async () => {
      try {
        const manager = MiningManager.getInstance()
        const sessions = manager.getActiveSessions()
        
        // Fetch user stats with throttling
        const users = await fetchUserStats()
        const globalPoW = (users && Array.isArray(users)) 
          ? users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)
          : 0
        
        // Get mining status from active sessions
        let hashRate = 0
        let bestHash = 'none'
        let mode = 'idle'
        const sessionPoints = sessions.reduce((sum, s) => sum + (s.accumulatedPoints || 0), 0)
        
        // Find the most active mining session
        if (sessions.length > 0) {
          // Prioritize by mode: dedicated > mouseover > background
          const dedicatedSession = sessions.find(s => s.mode === 'dedicated')
          const mouseoverSession = sessions.find(s => s.mode === 'mouseover')
          const backgroundSession = sessions.find(s => s.mode === 'background')
          
          const currentSession = dedicatedSession || mouseoverSession || backgroundSession
          
          if (currentSession && currentSession.currentProgress) {
            // Use actual hash rate from mining progress
            hashRate = currentSession.currentProgress.hashRate || 0
            bestHash = currentSession.currentProgress.hash?.substring(0, 16) || 'mining...'
            mode = currentSession.mode
          }
        }

        setStats({
          currentHashRate: hashRate,
          bestHash,
          onlineUsers: (users && Array.isArray(users)) ? users.length : 0,
          globalPoW,
          sessionPoints,
          sessionTime: Math.floor((Date.now() - startTime) / 1000),
          miningMode: mode
        })
      } catch (error: any) {
        // Silently handle errors - stats update is non-critical
        // Only log if it's not a network error (which is already handled)
        if (!error?.message?.includes('Network') && !error?.message?.includes('fetch')) {
          console.warn('[BottomToolbar] Stats update failed:', error?.message || 'Unknown error')
        }
      }
    }

    updateStats()
    // Increase interval from 1s to 2s to reduce load, throttle prevents excessive calls
    const interval = setInterval(updateStats, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const formatHashRate = (rate: number) => {
    if (rate === 0) return '0 H/s'
    if (rate < 1000) return `${rate} H/s`
    if (rate < 1000000) return `${(rate / 1000).toFixed(1)}k H/s`
    return `${(rate / 1000000).toFixed(1)}M H/s`
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isActiveMining = stats.miningMode !== 'idle'

  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 bg-background border-t border-primary text-primary text-[9px] md:text-[10px] z-50 flex items-center px-2 gap-2 md:gap-3 font-mono select-none overflow-hidden justify-between">
      
      {/* Navigation Links (4chan style clickbar) */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <Link to="/" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Home</span>
          <span className="sm:hidden">H</span>
        </Link>
        <Link to="/boards" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Boards</span>
          <span className="sm:hidden">B</span>
        </Link>
        <Link to="/mine" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Mine</span>
          <span className="sm:hidden">M</span>
        </Link>
        <Link to="/chat" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Chat</span>
          <span className="sm:hidden">C</span>
        </Link>
        <Link to="/settings" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Options</span>
          <span className="sm:hidden">O</span>
        </Link>
         <Link to="/themes" className="hover:bg-primary hover:text-background px-1 transition-colors font-bold flex items-center gap-1">
          <span className="hidden sm:inline">Themes</span>
          <span className="sm:hidden">T</span>
        </Link>
      </div>

      <div className="w-px h-3 bg-primary/30 shrink-0" />

      {/* Mining Stats - Scrolling/Compact */}
      <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1 justify-end">
        {/* Mining Status */}
        <div 
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 transition-colors whitespace-nowrap shrink-0",
            isActiveMining ? "bg-primary text-background font-bold animate-pulse" : "text-muted-foreground"
          )}
          title={isActiveMining 
            ? `Mining Mode: ${stats.miningMode.toUpperCase()} - Hash: ${stats.bestHash}` 
            : 'No active mining'}
        >
          <Cpu className="w-2.5 h-2.5" />
          <span className="uppercase hidden sm:inline">{isActiveMining ? stats.miningMode : 'IDLE'}</span>
        </div>

        <div className="w-px h-3 bg-primary/30 hidden sm:block shrink-0" />

        {/* Hash Rate */}
        <div 
          className="flex items-center gap-1 min-w-[50px] whitespace-nowrap shrink-0" 
          title={`Current Hash Rate: ${formatHashRate(stats.currentHashRate)}`}
        >
          <Zap className={cn("w-2.5 h-2.5", isActiveMining && "text-primary fill-primary")} />
          <span>{formatHashRate(stats.currentHashRate)}</span>
        </div>

        <div className="w-px h-3 bg-primary/30 hidden md:block shrink-0" />

        <div 
          className="flex items-center gap-1 font-bold whitespace-nowrap shrink-0"
          title={`Session Points: ${stats.sessionPoints}`}
        >
          <span>Points: {stats.sessionPoints}</span>
        </div>

        {/* Extra stats hidden on mobile */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
           <div className="w-px h-3 bg-primary/30" />
           <div 
            className="flex items-center gap-1 text-primary whitespace-nowrap" 
            title={`Human Presence: ${stats.onlineUsers} online`}
          >
            <Users className="w-2.5 h-2.5 animate-pulse" />
            <span className="font-bold tracking-tighter">HUMAN PULSE: {stats.onlineUsers}</span>
          </div>
        </div>

        <div className="w-px h-3 bg-primary/30 hidden md:block shrink-0" />

        {/* Session Time */}
        <div 
          className="hidden md:flex items-center gap-1 text-muted-foreground justify-end whitespace-nowrap shrink-0" 
          title={`Session Duration: ${formatTime(stats.sessionTime)}`}
        >
          <Clock className="w-2.5 h-2.5" />
          <span>{formatTime(stats.sessionTime)}</span>
        </div>
      </div>
    </div>
  )
}
