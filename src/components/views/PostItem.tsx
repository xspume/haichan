import React from 'react'
import { MoreVertical, Trash2, Zap, Loader2 } from 'lucide-react'
import { DifficultyBandBadge, BadgesInline } from '../../lib/badge-utils'
import { processRichText } from '../../lib/rich-text'
import { MiningButton } from '../mining/MiningButton'
import { MiningProgressBadge } from '../ui/mining-progress-badge'
import { getFlagEmoji } from '../../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'

interface PostItemProps {
  post: any
  dedicatedSession: any
  isAdmin: boolean | undefined
  canDelete: boolean | null
  onPostNumberClick: (postNumber: string | number) => void
  onToggleMining: (e: React.MouseEvent, targetType: 'thread' | 'post', targetId: string) => void
  onModPost: (postId: string, reason: string) => void
  onDeletePost: () => Promise<void>
}

export const PostItem = React.memo(function PostItem({
  post,
  dedicatedSession,
  isAdmin,
  canDelete,
  onPostNumberClick,
  onToggleMining,
  onModPost,
  onDeletePost
}: PostItemProps) {
  const isPostMining = dedicatedSession?.targetId === post.id && dedicatedSession?.targetType === 'post'
  
  const richText = React.useMemo(() => processRichText(post.content), [post.content])

  const getEffectivePow = (basePow: number, id: string, type: 'thread' | 'post') => {
    if (dedicatedSession?.targetType === type && dedicatedSession?.targetId === id) {
      return basePow + (dedicatedSession.pendingPoints || 0)
    }
    return basePow
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = days[date.getDay()]
    
    const pad = (n: number) => n.toString().padStart(2, '0')
    
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear().toString().slice(-2)}(${day})${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  const formatHashAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const blocks = Math.floor(diff / (10 * 60 * 1000))
    return `${blocks} BLOCKS`
  }

  return (
    <div id={`p${post.post_number || post.postNumber}`} className="post-reply bg-card border border-border/40 p-1.5 mb-1.5 w-fit min-w-[300px] max-w-full">
      <div className="post-header flex items-center flex-wrap gap-1 text-[11px] mb-1 font-mono">
        <input type="checkbox" className="mr-1 scale-75 opacity-50" />
        <span className="font-bold text-[#117743]">
          {post.username || 'Anonymous'}
        </span>
        {post.tripcode && (
          <span className="text-[#117743] font-normal">!{post.tripcode}</span>
        )}
        <BadgesInline user={post} className="inline-flex scale-75 origin-left" />
        
        {post.countryCode && (
          <span title={post.countryCode} className="text-base leading-none">
            {getFlagEmoji(post.countryCode)}
          </span>
        )}

        <span className="text-foreground/70">{formatDate(post.createdAt)}</span>
        
        <span 
          className="cursor-pointer hover:underline text-primary/70 font-normal ml-1"
          onClick={() => onPostNumberClick(post.post_number || post.postNumber)}
        >
          No.{post.post_number || post.postNumber}
        </span>
        
        <span className="text-muted-foreground opacity-30 text-[9px] ml-1">[{formatHashAge(post.createdAt)}]</span>
        
        <div className="flex items-center gap-1 ml-1 opacity-70">
          <DifficultyBandBadge points={post.totalPow || 0} className="scale-75 origin-left" />
          {isPostMining && <MiningProgressBadge show={true} />}
        </div>
        
        {canDelete && (
          <div className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-mono bg-popover text-popover-foreground border-border rounded-none">
                <DropdownMenuLabel className="text-[10px]">Actions</DropdownMenuLabel>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem onClick={() => onModPost(post.id, 'too cheap')} className="text-[10px]">Flag: Too Cheap</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModPost(post.id, 'too loud')} className="text-[10px]">Flag: Too Loud</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModPost(post.id, 'already said')} className="text-[10px]">Flag: Already Said</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                  </>
                )}
                <DropdownMenuItem onClick={onDeletePost} className="text-destructive text-[10px]">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      <div className="flex gap-4">
        {post.imageUrl && (
          <div className="relative group shrink-0 mb-1">
            <div className={getEffectivePow(post.totalPow || 0, post.id, 'post') < 20 ? 'blur-sm grayscale transition-all duration-500' : ''}>
              <a href={post.imageUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="max-w-[150px] max-h-[150px] border border-border shadow-sm bg-white"
                />
              </a>
            </div>
            {getEffectivePow(post.totalPow || 0, post.id, 'post') < 20 && (
              <div 
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 cursor-pointer z-10"
                onClick={(e) => onToggleMining(e, 'post', post.id)}
              >
                <div className={`
                  text-[9px] font-mono px-1 py-0.5 border flex items-center gap-1
                  ${dedicatedSession?.targetId === post.id 
                    ? "bg-primary text-primary-foreground border-primary animate-pulse" 
                    : "bg-background text-foreground border-foreground hover:bg-muted"}
                `}>
                  {dedicatedSession?.targetId === post.id ? (
                    <>
                      <Loader2 className="w-2 h-2 animate-spin" />
                      MINING
                    </>
                  ) : (
                    <>
                      <Zap className="w-2 h-2" />
                      MINE
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1">
          <div className="post-content whitespace-pre-wrap break-words text-foreground font-mono text-[13px] leading-[1.3] mb-2">
            {richText}
          </div>
          
          <div className="flex gap-2 text-[9px] items-center text-muted-foreground opacity-50 group">
            <span className="font-mono text-primary/70">POW: {getEffectivePow(post.totalPow || 0, post.id, 'post')}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <MiningButton targetType="post" targetId={post.id} size="sm" className="h-4 px-1.5 text-[8px] bg-primary/20 hover:bg-primary/40 text-primary border-none rounded-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
