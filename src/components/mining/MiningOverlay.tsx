import React, { useMemo } from 'react'
import { useMining } from '../../hooks/use-mining'
import { Progress } from '../ui/progress'
import { Pickaxe, X, Loader2, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export function MiningOverlay() {
  const { dedicatedSession, stopDedicatedMining } = useMining()

  const progress = useMemo(() => {
    if (!dedicatedSession || !dedicatedSession.currentProgress) return 0
    const current = dedicatedSession.currentProgress.points || 0
    const target = dedicatedSession.targetPoints || 1
    const p = (current / target) * 100
    return Math.min(Math.max(p, 0), 100)
  }, [dedicatedSession])

  if (!dedicatedSession) return null

  const targetType = dedicatedSession.targetType.toUpperCase()
  const hashRate = dedicatedSession.currentProgress?.hashRate || 0
  const attempts = dedicatedSession.currentProgress?.attempts || 0
  const isComplete = progress >= 100

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-md p-6 border-4 bg-background shadow-3d relative overflow-hidden transition-all duration-500",
        isComplete ? "border-[#00FF00] shadow-[#00FF00]/20" : "border-primary shadow-primary/20"
      )}>
        {/* Animated background stripes */}
        <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-grid-white" />
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/20 animate-pulse",
            isComplete && "from-[#00FF00]/20 to-[#00FF00]/20"
          )} />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-2", isComplete ? "text-[#00FF00]" : "text-primary")}>
              <div className={cn(
                "p-2 border-2 transition-all duration-500",
                isComplete ? "border-[#00FF00] bg-[#00FF00]/10 scale-110" : "border-primary bg-primary/10 animate-pulse"
              )}>
                {isComplete ? <Zap className="w-6 h-6" /> : <Pickaxe className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight uppercase leading-none">
                  {isComplete ? "Success" : "Working"}
                </h2>
                <p className="text-[10px] opacity-60 uppercase tracking-wider mt-1">
                  {isComplete ? "Verified" : `Mining ${targetType} ${dedicatedSession.targetId ? `#${dedicatedSession.targetId}` : ''}`}
                </p>
              </div>
            </div>
            {!isComplete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={stopDedicatedMining}
                className="h-8 w-8 rounded-none border-2 border-primary hover:bg-primary hover:text-background transition-all"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className={cn(
              "relative h-8 border-2 overflow-hidden p-1 shadow-inner transition-all duration-500",
              isComplete ? "border-[#00FF00] bg-[#00FF00]/5" : "border-primary bg-primary/5"
            )}>
              <div 
                className={cn(
                  "h-full transition-all duration-300 ease-out flex items-center justify-end px-2",
                  isComplete ? "bg-[#00FF00]" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              >
                <span className={cn(
                  "text-[10px] font-bold tracking-tight transition-colors duration-500",
                  isComplete ? "text-black" : "text-background"
                )}>
                  {Math.floor(progress)}%
                </span>
              </div>
              {/* Scanline effect on progress bar */}
              <div className="absolute inset-0 pointer-events-none bg-scanline opacity-10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                "p-3 border-2 flex flex-col items-center transition-all duration-500",
                isComplete ? "border-[#00FF00]/30 bg-[#00FF00]/5" : "border-primary bg-primary/5"
              )}>
                <span className="text-[10px] uppercase opacity-60 mb-1">Hash Rate</span>
                <div className="flex items-center gap-1">
                  <Zap className={cn("w-3 h-3 transition-colors", isComplete ? "text-[#00FF00]" : "text-primary animate-pulse")} />
                  <span className="text-lg font-bold">{(hashRate / 1000).toFixed(1)}k</span>
                  <span className="text-[10px] opacity-60 uppercase">h/s</span>
                </div>
              </div>
              <div className={cn(
                "p-3 border-2 flex flex-col items-center transition-all duration-500",
                isComplete ? "border-[#00FF00]/30 bg-[#00FF00]/5" : "border-primary bg-primary/5"
              )}>
                <span className="text-[10px] uppercase opacity-60 mb-1">Attempts</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold">{attempts.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            {isComplete ? (
              <p className="text-[11px] leading-relaxed text-[#00FF00] uppercase font-bold tracking-wider">
                Work verified. Closing...
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-primary/80 uppercase tracking-tight max-w-[90%] mx-auto italic">
                Generating proof of work to secure your action.
              </p>
            )}
          </div>

          {!isComplete && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-primary/20">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-primary/60">Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
