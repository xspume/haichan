import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function NewThreadPage() {
  const { boardSlug } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!dbUser) {
      toast.error('You must be logged in')
      return
    }

    setSubmitting(true)
    try {
      // Get board ID
      const boards = await publicDb.db.boards.list({
        where: { slug: boardSlug },
        limit: 1
      })

      if (!boards || boards.length === 0) {
        toast.error('Board not found')
        return
      }

      const thread = await db.db.threads.create({
        boardId: boards[0].id,
        title: title.trim(),
        content: content.trim(),
        authorId: dbUser.id,
        authorName: dbUser.username || dbUser.displayName || 'Anonymous',
        postCount: 0
      })

      toast.success('Thread created!')
      navigate(`/board/${boardSlug}/thread/${thread.id}`)
    } catch (error) {
      console.error('Failed to create thread:', error)
      toast.error('Failed to create thread')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO /{boardSlug}/
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-2xl font-bold font-mono mb-6">NEW THREAD</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title" className="font-mono">TITLE *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Thread title..."
                className="mt-1 font-mono"
                maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="content" className="font-mono">CONTENT</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="mt-1 font-mono min-h-[200px]"
                maxLength={10000}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !title.trim()}
              className="w-full font-mono"
            >
              {submitting ? 'CREATING...' : 'CREATE THREAD'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
