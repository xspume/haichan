import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { getPoWValidationData, clearPoWValidationData } from '../lib/pow-validation'
import { invokeFunction } from '../lib/functions-utils'

export function NewThreadPage() {
  const { boardSlug } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

    if (!boardSlug) {
      toast.error('Board not found')
      return
    }

    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!dbUser) {
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
        const result = await db.storage.upload(image, `threads/${fileName}`)
        imageUrl = result.url
      }

      // 2. Get board ID
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
        userId: dbUser.id,
        username: dbUser.username || dbUser.displayName || 'Anonymous',
        title: title.trim(),
        content: content.trim(),
        imageUrl,
        replyCount: 0,
        bumpOrder: Math.floor(Date.now() / 1000),
        lastPostAt: new Date().toISOString(),
        expired: 0
      })

      const { data: powResult, error: powError } = await invokeFunction<any>('validate-pow', {
        body: {
          ...powData,
          targetType: 'thread',
          targetId: thread.id,
          userId: dbUser.id
        }
      })

      if (powError || powResult?.valid === false) {
        try {
          await db.db.threads.delete(thread.id)
        } catch (cleanupErr) {
          console.warn('Failed to cleanup thread after PoW failure:', cleanupErr)
        }
        throw new Error(powResult?.error || powError?.error || powError?.message || 'PoW validation failed')
      }

      clearPoWValidationData()

      toast.success('Thread created!')
      navigate(`/board/${boardSlug}/thread/${thread.id}`)
    } catch (error) {
      console.error('Failed to create thread:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create thread')
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
