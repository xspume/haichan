import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function NewReplyPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
        }
      } catch (error) {
        console.error('Failed to load thread:', error)
      } finally {
        setLoading(false)
      }
    }

    loadThread()
  }, [threadId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      toast.error('Content is required')
      return
    }

    if (!dbUser || !threadId) {
      toast.error('You must be logged in')
      return
    }

    setSubmitting(true)
    try {
      await db.db.posts.create({
        threadId,
        content: content.trim(),
        authorId: dbUser.id,
        authorName: dbUser.username || dbUser.displayName || 'Anonymous'
      })

      // Update thread post count
      if (thread) {
        await db.db.threads.update(threadId, {
          postCount: (thread.postCount || 0) + 1,
          lastPostAt: new Date().toISOString()
        })
      }

      toast.success('Reply posted!')
      navigate(`/board/${boardSlug}/thread/${threadId}`)
    } catch (error) {
      console.error('Failed to post reply:', error)
      toast.error('Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO THREAD
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-2xl font-bold font-mono mb-2">REPLY</h1>
          {thread && (
            <p className="text-sm text-muted-foreground mb-6 font-mono">
              Replying to: {thread.title || 'Untitled Thread'}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="content" className="font-mono">YOUR REPLY *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your reply..."
                className="mt-1 font-mono min-h-[200px]"
                maxLength={10000}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !content.trim()}
              className="w-full font-mono"
            >
              {submitting ? 'POSTING...' : 'POST REPLY'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
