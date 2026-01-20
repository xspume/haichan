import { Card } from "../ui/card"
import { BadgesInline, DifficultyBandBadge } from "../../lib/badge-utils"
import { CircularOrbImage } from "../ui/circular-orb-image"

interface PostPreviewProps {
  post: any
  position: { x: number, y: number }
}

export function PostPreview({ post, position }: PostPreviewProps) {
  if (!post) return null

  // Calculate position to keep it on screen
  // This is a simple implementation, might need refinement
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 20,
    top: position.y - 20,
    zIndex: 50,
    maxWidth: '400px',
    pointerEvents: 'none' // Don't let it interfere with mouse
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={style}>
      <div className="border border-border/40 bg-card p-1.5 shadow-2xl font-mono text-[11px] min-w-[300px]">
        <div className="flex items-center flex-wrap gap-1 mb-1 border-b border-border/20 pb-1">
           <span className="font-bold text-[#117743]">
             {post.username || 'Anonymous'}
           </span>
           {post.tripcode && <span className="text-[#117743]">!{post.tripcode}</span>}
           <BadgesInline user={post} className="inline-flex scale-75 origin-left" />
           <span className="text-foreground/70 ml-1">{formatDate(post.createdAt)}</span>
           <span className="text-primary/70 ml-1">No.{post.post_number || post.postNumber}</span>
        </div>
        <div className="flex gap-3 mt-1">
          {post.imageUrl && (
            <div className="shrink-0">
               <img 
                 src={post.imageUrl} 
                 alt="Preview" 
                 className="max-w-[100px] max-h-[100px] border border-border bg-muted" 
               />
            </div>
          )}
          <div className="whitespace-pre-wrap break-words text-[13px] leading-tight">
            {post.content}
          </div>
        </div>
      </div>
    </div>
  )
}
