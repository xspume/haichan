import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Reply, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import { PostItem } from '../components/views/PostItem'
import { useMining } from '../hooks/use-mining'
import { QuickReplyForm } from '../components/views/QuickReplyForm'
import toast from 'react-hot-toast'

export function ThreadDetailPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, dbUser } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showQuickReply, setShowQuickReply] = useState(false)
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined)
  const { dedicatedSession, startDedicatedMining, stopDedicatedMining } = useMining()

  useEffect(() => {
    async function loadThread() {
      try {
        if (!threadId) return

        const threads = await publicDb.db.threads.list({
          where: { id: threadId },
          limit: 1
        })

        if (threads && threads.length > 0) {
          setThread(threads[0])

          const threadPosts = await publicDb.db.posts.list({
            where: { threadId },
            limit: 500
          })
          setPosts(threadPosts || [])
        }
      } catch (error) {
        console.error('Failed to load thread:', error)
      } finally {
        setLoading(false)
      }
    }

    loadThread()
  }, [threadId])

  const handlePostNumberClick = (num: string | number) => {
    setReplyTo(num.toString())
    setShowQuickReply(true)
  }

  const handleToggleMining = (e: React.MouseEvent, targetType: 'thread' | 'post', targetId: string) => {
    e.preventDefault()
    if (dedicatedSession?.targetId === targetId) {
      stopDedicatedMining()
    } else {
      startDedicatedMining(targetType, targetId)
    }
  }

  const handleDeletePost = async (type: 'thread' | 'post', id: string) => {
    if (!window.confirm('Are you sure you want to delete this?')) return

    try {
      if (type === 'thread') {
        await db.db.threads.delete(id)
        toast.success('Thread deleted')
        navigate(`/board/${boardSlug}`)
      } else {
        await db.db.posts.delete(id)
        setPosts(prev => prev.filter(p => p.id !== id))
        toast.success('Post deleted')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete')
    }
  }

  const handleModPost = async (id: string, reason: string) => {
    toast.info(`Flagged: ${reason}`)
  }

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING</div>
        </div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">THREAD NOT FOUND</div>
          <Button onClick={() => navigate(`/board/${boardSlug}`)} variant="outline">
            Back to Board
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to /{boardSlug}/
        </button>

        <div className="space-y-4">
          {/* Original Post (Thread) */}
          <div className="thread-op mb-6">
            <PostItem
              post={{
                ...thread,
                post_number: thread.postNumber || thread.post_number
              }}
              dedicatedSession={dedicatedSession}
              targetType="thread"
              isAdmin={Number(dbUser?.isAdmin) > 0}
              canDelete={Number(dbUser?.isAdmin) > 0 || dbUser?.id === thread.userId}
              onPostNumberClick={handlePostNumberClick}
              onToggleMining={(e) => handleToggleMining(e, 'thread', thread.id)}
              onModPost={handleModPost}
              onDeletePost={() => handleDeletePost('thread', thread.id)}
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b-2 border-foreground mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider font-mono">
              Replies ({posts.length})
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowQuickReply(!showQuickReply)}
                variant="outline"
                size="sm"
                className="font-mono h-8"
              >
                <MessageSquare className="w-3 h-3 mr-2" />
                Quick Reply
              </Button>
              {isAuthenticated && (
                <Button
                  onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}/reply`)}
                  size="sm"
                  className="font-mono h-8"
                >
                  <Reply className="w-3 h-3 mr-2" />
                  Post Reply
                </Button>
              )}
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="border-2 border-dashed border-muted-foreground p-8 text-center bg-card/50">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">No replies yet.</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostItem
                key={post.id}
                post={{
                  ...post,
                  post_number: post.postNumber || post.post_number
                }}
                dedicatedSession={dedicatedSession}
                isAdmin={Number(dbUser?.isAdmin) > 0}
                canDelete={Number(dbUser?.isAdmin) > 0 || dbUser?.id === post.userId}
                onPostNumberClick={handlePostNumberClick}
                onToggleMining={(e) => handleToggleMining(e, 'post', post.id)}
                onModPost={handleModPost}
                onDeletePost={() => handleDeletePost('post', post.id)}
              />
            ))
          )}
        </div>
        
        {isAuthenticated && (
          <div className="mt-8 flex justify-center">
            <Button
              onClick={() => setShowQuickReply(true)}
              className="font-mono px-8"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Quick Reply
            </Button>
          </div>
        )}

        {showQuickReply && boardSlug && threadId && (
          <QuickReplyForm
            boardSlug={boardSlug}
            threadId={threadId}
            replyTo={replyTo}
            onClose={() => {
              setShowQuickReply(false)
              setReplyTo(undefined)
            }}
            onSuccess={() => {
              // Refresh posts after success
              setLoading(true)
              loadThread()
              setShowQuickReply(false)
              setReplyTo(undefined)
            }}
          />
        )}
      </div>
    </div>
  )
}
