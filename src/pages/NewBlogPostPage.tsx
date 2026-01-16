import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function NewBlogPostPage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }

    if (!dbUser) {
      toast.error('You must be logged in')
      return
    }

    setSubmitting(true)
    try {
      const post = await db.db.blogPosts.create({
        title: title.trim(),
        content: content.trim(),
        authorId: dbUser.id,
        authorName: dbUser.username || dbUser.displayName || 'Anonymous',
        published: true
      })

      toast.success('Blog post published!')
      navigate(`/blog/${post.id}`)
    } catch (error) {
      console.error('Failed to create blog post:', error)
      toast.error('Failed to create blog post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate('/blogs')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BLOGS
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-2xl font-bold font-mono mb-6">NEW BLOG POST</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title" className="font-mono">TITLE *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title..."
                className="mt-1 font-mono"
                maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="content" className="font-mono">CONTENT *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your blog post..."
                className="mt-1 font-mono min-h-[300px]"
                maxLength={50000}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="w-full font-mono"
            >
              {submitting ? 'PUBLISHING...' : 'PUBLISH POST'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
