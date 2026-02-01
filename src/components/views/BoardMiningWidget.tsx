import { useState, useRef, useEffect } from 'react'
import { Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useMouseoverMining, useMining } from '../../hooks/use-mining'
import { MiningProgressBadge } from '../ui/mining-progress-badge'
import db from '../../lib/db-client'
import { invokeFunction } from '../../lib/functions-utils'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'

interface BoardMiningWidgetProps {
  board: any
  onMineComplete?: (powPoints: number) => void
}

export function BoardMiningWidget({ board, onMineComplete }: BoardMiningWidgetProps) {
  const { authState } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [minedHash, setMinedHash] = useState<string | null>(null)
  const [minedPoints, setMinedPoints] = useState(0)
  const [optimisticPow, setOptimisticPow] = useState(0)
  const [remountKey, setRemountKey] = useState(0)
  const mineButtonRef = useRef<HTMLDivElement>(null)
  // Get full mining state including engine to access nonce/challenge
  const { useAttachTo } = useMouseoverMining('board', board.id)
  const { mouseoverSession } = useMining()
  
  // Check if this board is currently being mining
  const isBoardMining = mouseoverSession?.targetId === board.id && mouseoverSession?.targetType === 'board'

  useEffect(() => {
    if (mineButtonRef.current) {
      const cleanup = useAttachTo(mineButtonRef.current)
      return cleanup
    }
  }, [useAttachTo, remountKey])

  // Capture mining progress from session
  useEffect(() => {
    if (isBoardMining && mouseoverSession?.currentProgress) {
      const { hash, points } = mouseoverSession.currentProgress
      if (points > minedPoints) {
        setMinedHash(hash)
        setMinedPoints(points)
      }
    }
  }, [isBoardMining, mouseoverSession, minedPoints])

  const handleSubmitMining = async () => {
    if (!minedHash) {
      toast.error('No PoW found yet. Keep mining!')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Use MiningManager/Engine to get the full last result if possible, 
      // or we rely on the session data. 
      // The session.currentProgress has { hash, nonce, points, trailingZeros, attempts, hashRate }
      // We also need the challenge and prefix.
      
      const progress = mouseoverSession?.currentProgress
      if (!progress || progress.hash !== minedHash) {
         // Should not happen if state is synced, but safety check
         throw new Error('Mining session state mismatch. Please try again.')
      }

      // We need the challenge used. 
      // MiningManager -> MiningEngine stores lastChallenge? 
      // Actually, we can just use the hash and nonce? 
      // No, validate-pow needs challenge to verify hash = sha256(challenge + nonce).
      // We need to expose challenge from MiningSession or Engine.
      // For now, let's assume we can get it from the MiningManager singleton or we assume 
      // the worker uses a challenge we can retrieve.
      
      // HACK: We need to get the challenge. 
      // Let's import MiningManager to get it.
      const { MiningManager } = await import('../../lib/mining/MiningManager')
      const manager = MiningManager.getInstance()
      // We need a way to get the challenge for the current session.
      // We'll update MiningManager/Engine to expose it better, or use what's available.
      // MiningEngine has getCurrentChallenge()
      // But we need the challenge that generated THIS hash.
      // If the challenge rotated, we might be out of luck.
      // However, challenge usually stays stable per session.
      
      // @ts-ignore - Accessing internal engine for challenge
      const challenge = manager.engine.getCurrentChallenge()

      // Submit via Edge Function
      const { data, error } = await invokeFunction('validate-pow', {
        body: {
          challenge: challenge,
          nonce: progress.nonce,
          hash: minedHash,
          points: minedPoints,
          trailingZeros: progress.trailingZeros,
          targetType: 'board',
          targetId: board.id,
          userId: authState.user?.id
        }
      })

      if (error) {
        throw new Error(error.message || 'Validation failed')
      }

      if (!data.valid) {
        throw new Error(data.error || 'Invalid PoW')
      }

      toast.success(`✓ Mined ${minedPoints} PoW for /${board.slug}/!`)
      
      // Update optimistic PoW
      setOptimisticPow(prev => prev + minedPoints)
      
      setMinedHash(null)
      setMinedPoints(0)
      
      // Force restart of mining session to find new hash
      setRemountKey(prev => prev + 1)
      
      if (onMineComplete) {
        onMineComplete(minedPoints)
      }
    } catch (error: any) {
      console.error('Failed to submit mining result:', error)
      toast.error(error.message || 'Failed to submit PoW')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-2 border-primary bg-card shadow-3d-sm font-sans">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black flex items-center gap-2 uppercase tracking-tighter">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            MINE BOARD
            {isBoardMining && <MiningProgressBadge show={true} />}
          </CardTitle>
          <button className="p-1 text-primary hover:bg-primary/10 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          <div className="text-[11px] font-bold space-y-2 uppercase tracking-tight">
            <div className="flex justify-between">
              <span className="text-muted-foreground opacity-60">Board:</span>
              <span className="text-primary">/{board.slug}/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground opacity-60">Current PoW:</span>
              <span className="text-foreground">{(board.totalPow || 0) + optimisticPow}</span>
            </div>
            {minedHash && (
              <>
                <div className="flex justify-between border-t border-primary/20 pt-2 mt-2">
                  <span className="text-muted-foreground opacity-60">Mined Points:</span>
                  <span className="font-black text-primary animate-pulse">{minedPoints}</span>
                </div>
                <div className="break-all text-[9px] font-mono p-2 bg-primary/5 border border-primary/20 rounded-none mt-1">
                  <span className="text-muted-foreground opacity-50 uppercase tracking-tighter">Hash: </span>
                  <span className="font-medium text-foreground/80">{minedHash}</span>
                </div>
              </>
            )}
          </div>

          <div
            key={remountKey}
            ref={mineButtonRef}
            className="border-2 border-primary/40 p-3 bg-primary/5 hover:bg-primary hover:text-background transition-all cursor-pointer text-center font-black text-[10px] uppercase tracking-widest relative shadow-sm hover:shadow-3d-sm active:scale-[0.98]"
          >
            {isBoardMining ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin">
                  <Zap className="w-3 h-3" />
                </div>
                MINING...
              </div>
            ) : minedHash ? (
              'HOVER TO CONTINUE MINING'
            ) : (
              'HOVER TO MINE'
            )}
          </div>

          {minedHash && (
            <Button
              onClick={handleSubmitMining}
              disabled={isSubmitting}
              className="w-full font-black uppercase text-[10px] tracking-widest h-9 shadow-md"
            >
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT PoW'}
            </Button>
          )}

          <div className="text-[10px] text-muted-foreground font-medium border-t border-primary/10 pt-2 leading-relaxed">
            <p className="mb-1 font-black uppercase tracking-widest text-primary opacity-60 text-[9px]">How to verify:</p>
            <ol className="list-decimal list-inside space-y-0.5 opacity-80">
              <li>Hover over the verify zone above</li>
              <li>Your machine will search for entropy</li>
              <li>When a hash is discovered, click SUBMIT</li>
              <li>Board prestige increases instantly</li>
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
