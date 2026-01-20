import { useRef, useEffect, useState, memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, MessageCircle, User, Clock } from 'lucide-react'
import { DifficultyBandBadge } from '../../lib/badge-utils'
import { CircularOrbImage } from '../ui/circular-orb-image'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { useMouseoverMining, useMining } from '../../hooks/use-mining'
import { MiningProgressBadge } from '../ui/mining-progress-badge'
import { cn } from '@/lib/utils'

interface ThreadCardProps {
  thread: any
  boardSlug: string
  replyCount?: number
  isMining: boolean
}

// Memoized ThreadCard to prevent re-renders when parent state changes
const ThreadCard = memo(function ThreadCard({ 
  thread, 
  boardSlug, 
  replyCount = 0,
  isMining
}: ThreadCardProps) {
  const { useAttachTo } = useMouseoverMining('thread', thread.id)
  const elementRef = useRef<HTMLDivElement>(null)

  const truncate = useCallback((text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }, [])

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }, [])

  useEffect(() => {
    if (elementRef.current) {
      return useAttachTo(elementRef.current)
    }
  }, [useAttachTo])

  const cardContent = (
    <div
      ref={elementRef}
      className="bg-card border border-border/40 hover:bg-primary/5 transition-all cursor-crosshair h-full flex flex-col group overflow-hidden rounded-none"
    >
      {/* Thread Image */}
      {thread.imageUrl && (
        <div className="w-full aspect-square border-b border-border/20 overflow-hidden bg-muted flex items-center justify-center relative">
          <div className={cn("w-full h-full transition-all duration-700", (thread.totalPow || 0) < 20 ? 'blur-md opacity-50 grayscale' : 'group-hover:scale-105')}>
            <img
              src={thread.imageUrl}
              alt={thread.title}
              className="w-full h-full object-cover"
            />
          </div>
          {(thread.totalPow || 0) < 20 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
              <div className="bg-background text-primary text-[8px] font-black uppercase tracking-wider px-2 py-1 border border-primary animate-pulse">
                Verification Required
              </div>
            </div>
          )}
          {isMining && (
            <div className="absolute top-2 right-2 z-10">
              <MiningProgressBadge show={true} />
            </div>
          )}
        </div>
      )}

      {/* Thread Info */}
      <div className="p-2 flex-1 flex flex-col gap-1.5 font-mono">
        <div className="flex flex-wrap gap-1">
          <DifficultyBandBadge points={thread.totalPow || 0} className="scale-75 origin-left" />
          {!thread.imageUrl && isMining && <MiningProgressBadge show={true} />}
        </div>
        
        <h3 className="font-bold text-[11px] uppercase tracking-tighter line-clamp-2 text-primary group-hover:underline">
          {truncate(thread.title, 50)}
        </h3>
        
        <p className="text-[10px] text-foreground/60 line-clamp-3 flex-1 leading-tight">
          {truncate(thread.content, 100)}
        </p>

        <div className="pt-1.5 border-t border-border/10 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 opacity-60 overflow-hidden">
            <span className="truncate text-[#117743]">{thread.username || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-2 text-primary/70 tabular-nums">
            <span className="flex items-center gap-0.5">
              Replies: {replyCount}
            </span>
            <span className="flex items-center gap-0.5 font-black">
              Work: {thread.totalPow || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <Link to={`/board/${boardSlug}/thread/${thread.id}`} className="block h-full w-full">
          {cardContent}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 rounded-none border-2 border-primary bg-background text-primary shadow-3d-lg z-50 p-4" side="right">
        <div className="space-y-3">
          <div>
            <h4 className="font-bold text-base mb-1 line-clamp-2 text-primary">{thread.title}</h4>
            <p className="text-xs text-muted-foreground mb-2">{truncate(thread.content, 200)}</p>
          </div>
          
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-primary" />
              <span className="text-xs">
                <span className="font-bold">Poster:</span> {thread.username || 'Anonymous'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-primary" />
              <span className="text-xs">
                <span className="font-bold">Replies:</span> {replyCount}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-xs">
                <span className="font-bold">Total PoW:</span> {thread.totalPow || 0}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-primary" />
              <span className="text-xs">
                <span className="font-bold">Created:</span> {formatDate(thread.createdAt)}
              </span>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Click to view thread
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
})

interface BoardCatalogProps {
  threads: any[]
  boardSlug: string
}

export function BoardCatalog({ threads, boardSlug }: BoardCatalogProps) {
  const { mouseoverSession } = useMining()
  const currentMiningThreadId = mouseoverSession?.targetType === 'thread' ? mouseoverSession.targetId : null

  if (threads.length === 0) {
    return (
      <div className="border-2 border-foreground p-8 text-center">
        <p className="font-mono text-muted-foreground">No threads yet. Create the first thread.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {threads.map((thread) => (
        <ThreadCard 
          key={thread.id} 
          thread={thread} 
          boardSlug={boardSlug}
          replyCount={thread.replyCount || 0}
          isMining={currentMiningThreadId === thread.id}
        />
      ))}
    </div>
  )
}
