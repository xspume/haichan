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
        bg: 'bg-blue-500/20',
        border: 'border-blue-500',
        text: 'LURK_MODE',
        color: 'text-blue-400',
        icon: '🌙'
      }
    }
    if (powerMode === 'low') {
      return {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500',
        text: 'LOW_POWER',
        color: 'text-yellow-400',
        icon: '🔋'
      }
    }
    return {
      bg: 'bg-primary/20',
      border: 'border-primary',
      text: `${hashRate.toFixed(0)} H/S`,
      color: 'text-primary',
      icon: <Zap className="w-3 h-3 text-primary" />
    }
  }

  const config = getStatusConfig()

  return (
    <div 
      className={`flex items-center gap-1.5 px-2.5 py-1 border-2 font-sans transition-all ${config.bg} ${config.border} ${config.color} animate-pulse shadow-sm`}
      title={`Mining active: ${hashRate.toFixed(0)} H/s (${powerMode} power)`}
    >
      <span className="flex items-center justify-center">
        {config.icon}
      </span>
      <span className="font-black text-[10px] uppercase tracking-widest">
        {config.text}
      </span>
      <div className={`w-1.5 h-1.5 rounded-full animate-ping ${config.color.replace('text-', 'bg-')}`} />
    </div>
  )
}