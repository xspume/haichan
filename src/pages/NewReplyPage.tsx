import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { getPoWValidationData, clearPoWValidationData } from '../lib/pow-validation'
import { invokeFunction } from '../lib/functions-utils'

export function NewReplyPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB')
        return
      }
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
  }

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

    const powData = getPoWValidationData()
    if (!powData) {
      toast.error('PoW required: mine a 21e8 hash first')
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload image if present
      let imageUrl = ''
      if (image) {
        const fileName = `${Date.now()}-${image.name}`
        const result = await db.storage.upload(image, `posts/${fileName}`)
        imageUrl = result.url
      }

      // 2. Create post
      const post = await db.db.posts.create({
        threadId,
        userId: dbUser.id,
        username: dbUser.username || dbUser.displayName || 'Anonymous',
        content: content.trim(),
        imageUrl
      })

      const { data: powResult, error: powError } = await invokeFunction<any>('validate-pow', {
        body: {
          ...powData,
          targetType: 'post',
          targetId: post.id,
          userId: dbUser.id
        }
      })

      if (powError || powResult?.valid === false) {
        try {
          await db.db.posts.delete(post.id)
        } catch (cleanupErr) {
          console.warn('Failed to cleanup post after PoW failure:', cleanupErr)
        }
        throw new Error(powResult?.error || powError?.error || powError?.message || 'PoW validation failed')
      }

      clearPoWValidationData()

      // Update thread post count
      if (thread) {
        await db.db.threads.update(threadId, {
          replyCount: (Number(thread.replyCount) || 0) + 1,
          lastPostAt: new Date().toISOString(),
          bumpOrder: Math.floor(Date.now() / 1000),
          updatedAt: new Date().toISOString()
        })
      }

      toast.success('Reply posted!')
      navigate(`/board/${boardSlug}/thread/${threadId}`)
    } catch (error) {
      console.error('Failed to post reply:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to post reply')
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

            <div>
              <Label className="font-mono">IMAGE (OPTIONAL)</Label>
              <div className="mt-1 flex items-center gap-4">
                {!imagePreview ? (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-foreground cursor-pointer hover:bg-muted transition-colors">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    <span className="text-[10px] font-mono mt-2">UPLOAD</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                ) : (
                  <div className="relative w-32 h-32 border-2 border-foreground bg-white">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-foreground text-background p-1 border-2 border-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono italic">
                  MAX 5MB. JPG, PNG, WEBP SUPPORTED.
                </div>
              </div>
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