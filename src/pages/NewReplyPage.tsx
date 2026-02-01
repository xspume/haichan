import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, X, Palette } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { DoodleMining } from '../components/views/DoodleMining'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { getPoWValidationData, clearPoWValidationData } from '../lib/pow-validation'
import { invokeFunction } from '../lib/functions-utils'
import { createNotificationsForPost } from '../lib/notifications'
import { guessCountryCode } from '../lib/utils'

export function NewReplyPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [postAnonymously, setPostAnonymously] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleCanvasImage = (imageUrl: string) => {
    setImagePreview(imageUrl)
    
    // Convert base64 to blob for uploading
    const fetchRes = fetch(imageUrl)
    fetchRes.then(res => res.blob()).then(blob => {
      setImage(blob)
    })
    
    setShowCanvas(false)
    toast.success('Canvas image applied!')
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

    if (!image) {
      toast.error('Image is mandatory for replies')
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
      // 1. Upload image
      let imageUrl = ''
      if (image) {
        const fileName = `${Date.now()}-${image instanceof File ? image.name : 'canvas-upload.png'}`
        const result = await db.storage.upload(image, `posts/${fileName}`)
        imageUrl = result.url
      }

      // 2. Securely validate and create post (Fix 3 & 5)
      const { data: result, error: powError } = await invokeFunction<any>('validate-pow', {
        body: {
          ...powData,
          targetType: 'post',
          userId: dbUser.id,
          createPostData: {
            threadId,
            content: content.trim(),
            imageUrl,
            username: postAnonymously ? 'Anonymous' : (dbUser.username || dbUser.displayName || 'Anonymous'),
            countryCode: guessCountryCode()
          }
        }
      })

      if (powError || result?.valid === false) {
        throw new Error(result?.error || powError?.message || 'PoW validation failed')
      }

      const createdPostId = result.postId;

      // Create notifications
      if (createdPostId) {
        createNotificationsForPost(
          content,
          threadId,
          createdPostId,
          dbUser.id
        ).catch(err => console.warn('Notification error:', err))
      }

      clearPoWValidationData()

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
    <div className="bg-background text-foreground min-h-screen font-sans">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO THREAD
        </button>

        <div className="border-4 border-primary bg-card text-card-foreground p-6 shadow-3d-sm">
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">REPLY TO THREAD</h1>
          {thread && (
            <p className="text-[10px] text-muted-foreground mb-6 font-bold uppercase tracking-widest opacity-70">
              TARGET: {thread.title || 'Untitled Thread'}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="content" className="font-bold uppercase tracking-widest text-[10px]">Your Reply *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Message..."
                className="mt-1 min-h-[150px] leading-relaxed"
                maxLength={10000}
              />
            </div>

            <div className="border-2 border-primary/20 p-4 bg-primary/5">
              <Label className="font-bold uppercase tracking-widest text-[10px] mb-3 block">File *</Label>
              <div className="flex flex-wrap items-center gap-4">
                {!imagePreview ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-24 w-24 flex-col gap-2 border-2 border-primary border-dashed bg-background hover:bg-primary/10 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="w-6 h-6 text-primary" />
                      <span className="text-[10px] font-black uppercase">UPLOAD</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />

                    <Dialog open={showCanvas} onOpenChange={setShowCanvas}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-24 w-24 flex-col gap-2 border-2 border-foreground border-dashed bg-background"
                        >
                          <Palette className="w-6 h-6" />
                          <span className="text-[10px] font-bold">DRAW</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] w-[800px] h-[90vh] p-0 overflow-hidden border-4 border-foreground rounded-none bg-background shadow-3d">
                        <DialogHeader className="p-4 border-b-2 border-foreground bg-primary text-background">
                          <DialogTitle className="font-mono uppercase">Canvas Mode</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto bg-muted">
                          <DoodleMining 
                            onImageGenerated={handleCanvasImage}
                            showMining={false}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : (
                  <div className="relative w-32 h-32 border-2 border-foreground bg-muted group">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-foreground text-background p-1 border-2 border-foreground hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                       <span className="text-[10px] text-primary-foreground font-black bg-primary px-1 uppercase tracking-widest">SELECTED</span>
                    </div>
                  </div>
                )}
                
                <div className="flex-1 min-w-[200px] space-y-1">
                  <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    {image ? '✓ IMAGE SELECTED' : '⚠ IMAGE REQUIRED'}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono leading-tight">
                    MAX 5MB. JPG, PNG, WEBP SUPPORTED.<br />
                    USE THE DRAW TOOL TO CREATE CUSTOM ART.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-2 border-primary/20 p-3 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer shadow-sm"
                 onClick={() => setPostAnonymously(!postAnonymously)}>
              <Checkbox 
                id="anonymous" 
                checked={postAnonymously}
                onCheckedChange={(checked) => setPostAnonymously(checked === true)}
                className="border-2 border-primary"
              />
              <Label
                htmlFor="anonymous"
                className="text-[10px] uppercase font-black tracking-widest cursor-pointer"
              >
                Post Anonymously
              </Label>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting || !content.trim() || !image}
                className="w-full py-6 border-4 border-primary shadow-3d-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:translate-none uppercase font-black tracking-widest"
              >
                {submitting ? 'PROCESSING...' : 'POST REPLY'}
              </Button>
              <p className="text-[9px] text-center mt-3 text-muted-foreground uppercase font-bold tracking-tighter">
                Note: All posts require a valid 21e8 proof-of-work hash.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
