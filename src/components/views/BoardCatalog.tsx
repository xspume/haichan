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
    if (!text) return ''
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

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <Link 
          to={`/board/${boardSlug}/thread/${thread.id}`} 
          className="catalog-item group"
          ref={elementRef}
        >
          {/* Thread Image Container */}
          <div className="catalog-thumb-container">
            {thread.imageUrl && (
              <img
                src={thread.imageUrl}
                alt={thread.title}
                className={cn(
                  "catalog-thumb transition-all duration-300",
                  (thread.totalPow || 0) < 20 ? 'blur-md grayscale opacity-40' : 'group-hover:scale-105'
                )}
              />
            )}
            
            {/* Status Overlays */}
            {(thread.totalPow || 0) < 20 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                <div className="bg-background/80 text-[8px] font-bold border border-primary px-1 animate-pulse uppercase">
                  Locked
                </div>
              </div>
            )}
            
            {isMining && (
              <div className="absolute top-1 right-1">
                <MiningProgressBadge show={true} />
              </div>
            )}
          </div>

          {/* Metadata Section */}
          <div className="catalog-meta">
            <div className="catalog-stats">
              <span>R: <b>{replyCount}</b></span>
              <span>W: <b>{thread.totalPow || 0}</b></span>
            </div>
            
            <h3 className="catalog-title">
              {thread.title || 'Untitled'}
            </h3>
            
            <p className="catalog-snippet">
              {truncate(thread.content, 80)}
            </p>
          </div>
        </Link>
      </HoverCardTrigger>
      
      <HoverCardContent className="w-80 rounded-none border-2 border-primary bg-background text-primary shadow-3d-lg z-50 p-3 font-sans" side="bottom">
        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-start gap-2 mb-1">
              <h4 className="font-bold text-sm line-clamp-2 text-primary leading-tight">
                {thread.title || 'Untitled Thread'}
              </h4>
              <DifficultyBandBadge points={thread.totalPow || 0} className="scale-75 origin-right shrink-0" />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-4 leading-normal italic">
              "{truncate(thread.content, 250)}"
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-y-1 text-[10px] border-t border-border/20 pt-2 uppercase font-bold tracking-tight">
            <div className="flex items-center gap-1.5">
              <User className="w-2.5 h-2.5 text-primary" />
              <span className="truncate">{thread.username || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <MessageCircle className="w-2.5 h-2.5 text-primary" />
              <span>{replyCount} Replies</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-2.5 h-2.5 text-primary" />
              <span>Work: {thread.totalPow || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Clock className="w-2.5 h-2.5 text-primary" />
              <span>{formatDate(thread.createdAt)}</span>
            </div>
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
      <div className="border border-border p-8 text-center bg-card/50">
        <p className="font-sans text-muted-foreground text-sm italic">No threads yet. Create the first thread.</p>
      </div>
    )
  }

  return (
    <div className="catalog-container">
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
