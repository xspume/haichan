import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Reply, MessageSquare } from 'lucide-react'
import { Button } from '../components/ui/button'
import { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'

export function ThreadDetailPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
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
            BACK TO BOARD
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
          BACK TO /{boardSlug}/
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-4 mb-6">
          <h1 className="text-xl font-bold font-mono">{thread.title || 'Untitled Thread'}</h1>
          {thread.content && (
            <p className="mt-2 whitespace-pre-wrap">{thread.content}</p>
          )}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-muted">
            <span className="text-xs text-muted-foreground font-mono">
              {posts.length} replies
            </span>
            {isAuthenticated && (
              <Button
                onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}/reply`)}
                size="sm"
                className="font-mono"
              >
                <Reply className="w-4 h-4 mr-2" />
                REPLY
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground font-mono">No replies yet.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <div key={post.id} className="border-2 border-muted p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-2">
                  <span>#{index + 1}</span>
                  <span>{post.authorName || 'Anonymous'}</span>
                </div>
                <p className="whitespace-pre-wrap">{post.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
