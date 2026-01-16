import { useMining } from '../../hooks/use-mining'
import { Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

export function MiningStatusBadge() {
  const { backgroundSession, mouseoverSession, dedicatedSession } = useMining()
  const [hashRate, setHashRate] = useState(0)
  const [powerMode, setPowerMode] = useState<'high' | 'low' | 'lurk'>('high')
  
  const isActiveMining = backgroundSession || mouseoverSession || dedicatedSession
  
  // Calculate total hash rate from all active sessions
  useEffect(() => {
    const bgRate = backgroundSession?.currentProgress?.hashRate || 0
    const moRate = mouseoverSession?.currentProgress?.hashRate || 0
    const dedRate = dedicatedSession?.currentProgress?.hashRate || 0
    setHashRate(bgRate + moRate + dedRate)

    // Capture power mode from most prominent session
    const mode = dedicatedSession?.currentProgress?.powerMode || 
                 mouseoverSession?.currentProgress?.powerMode || 
                 backgroundSession?.currentProgress?.powerMode || 
                 'high'
    setPowerMode(mode)
  }, [backgroundSession, mouseoverSession, dedicatedSession])

  // Hide entirely when idle
  if (!isActiveMining) {
    return null
  }

  const getStatusConfig = () => {
    if (powerMode === 'lurk') {
      return {
        bg: 'bg-blue-400',
        border: 'border-blue-600',
        text: 'Lurk Mode',
        icon: '🌙'
      }
    }
    if (powerMode === 'low') {
      return {
        bg: 'bg-yellow-400',
        border: 'border-yellow-600',
        text: 'Low Power',
        icon: '🔋'
      }
    }
    return {
      bg: 'bg-green-400',
      border: 'border-green-600',
      text: `${hashRate.toFixed(0)} H/s`,
      icon: <Zap className="w-3 h-3" />
    }
  }

  const config = getStatusConfig()

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 py-1 border text-xs font-mono transition-all text-black ${config.bg} ${config.border} animate-pulse`}
      title={`Mining active: ${hashRate.toFixed(0)} H/s (${powerMode} power)`}
    >
      <span className="flex items-center justify-center">
        {config.icon}
      </span>
      <span className="font-bold uppercase tracking-tighter">
        {config.text}
      </span>
      <div className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
    </div>
  )
}
