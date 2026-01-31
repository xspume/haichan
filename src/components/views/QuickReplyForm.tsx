import { useState, useRef, useEffect } from 'react'
import { X, Minimize2, Maximize2, Image as ImageIcon, Send, Loader2, Palette } from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'
import { Card } from '../ui/card'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { DoodleMining } from './DoodleMining'
import { parseTripcode, generateTripcode } from '../../lib/tripcode'
import { isValidImageForBoard, getImageValidationError } from '../../lib/image-validation'
import { saveToImageLibrary } from '../../lib/image-library'
import { fetchPostNumberWithPoW, getPoWValidationData, clearPoWValidationData } from '../../lib/pow-validation'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { invokeFunction } from '../../lib/functions-utils'
import { calculateThreadDifficulty, isThreadLocked } from '../../lib/pow-config'
import db, { publicDb } from '../../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { createNotificationsForPost } from '../../lib/notifications'
import { guessCountryCode } from '../../lib/utils'
import { requestCache } from '../../lib/request-cache'

interface QuickReplyFormProps {
  boardSlug: string
  threadId: string
  replyTo?: string
  onClose?: () => void
  onSuccess?: () => void
  minimized?: boolean
}

export function QuickReplyForm({ boardSlug, threadId, replyTo, onClose, onSuccess, minimized: initialMinimized = false }: QuickReplyFormProps) {
  const [minimized, setMinimized] = useState(initialMinimized)
  const [content, setContent] = useState('')
  const [nameField, setNameField] = useState('')
  const [imageFile, setImageFile] = useState<File | Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [postAnonymously, setPostAnonymously] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const { authState, siteSettings } = useAuth()
  
  // Mining state
  const [targetDifficulty, setTargetDifficulty] = useState({ prefix: '21e8', points: 15 })
  const hasValidPoW = usePoWValidity(targetDifficulty.prefix, targetDifficulty.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())
  const isSubmittingRef = useRef(false) // Prevent double submissions
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Initialize
  useEffect(() => {
    // If replyTo is provided, append it to content
    if (replyTo) {
      setContent(prev => {
        const prefix = `>>${replyTo}\n`
        return prev.startsWith(prefix) ? prev : prefix + prev
      })
      // Open if minimized
      if (minimized) setMinimized(false)
    }
  }, [replyTo])

  useEffect(() => {
    // Determine difficulty
    const initMining = async () => {
       try {
         const threads = await publicDb.db.threads.list({ where: { id: threadId } })
         if (threads.length === 0) return
         const thread = threads[0]

         const replyCount = await publicDb.db.posts.count({ where: { threadId } })
         const difficulty = calculateThreadDifficulty(
           replyCount, 
           thread.createdAt, 
           siteSettings?.difficultyMultiplier || 1.0
         )
         setTargetDifficulty(difficulty)
         
         // Mining is REQUIRED for posting
       if (!minimized && !hasValidPoW && !dedicatedSession) {
         miningManagerRef.current
           .startDedicatedMining('post', undefined, difficulty.points, difficulty.prefix)
           .catch(console.error)
       }
       } catch (e) {
         console.error(e)
       }
    }
    initMining()

    return () => {
      // Stop mining when quick reply unmounts
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [threadId, minimized, hasValidPoW, dedicatedSession])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!isValidImageForBoard(file, boardSlug)) {
        toast.error(getImageValidationError(boardSlug))
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleCanvasImage = (imageUrl: string) => {
    setImagePreview(imageUrl)
    
    // Convert base64 to blob for uploading
    const fetchRes = fetch(imageUrl)
    fetchRes.then(res => res.blob()).then(blob => {
      setImageFile(blob)
    })
    
    setShowCanvas(false)
    toast.success('Canvas image applied!')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submissions using ref (synchronous check)
    if (isSubmittingRef.current || loading) {
      console.log('[QuickReplyForm] Submission blocked - already in progress')
      return
    }
    isSubmittingRef.current = true
    
    if (!content.trim()) {
      isSubmittingRef.current = false
      return
    }

    if (!imageFile) {
      toast.error('Image is mandatory for replies')
      isSubmittingRef.current = false
      return
    }

    if (!authState.user) {
      toast.error('Login required')
      isSubmittingRef.current = false
      return
    }

    if (!hasValidPoW) {
      toast.error(`Mining not complete. Please wait for valid PoW (hash starting with ${targetDifficulty.prefix}, ${targetDifficulty.points}+ points).`)
      isSubmittingRef.current = false
      return
    }

    setLoading(true)
    try {
      const user = authState.user
      const finalUsername = postAnonymously ? 'Anonymous' : (user.username || 'Anonymous')
      
      let tripcode = ''
      if (nameField && !postAnonymously) {
        const { password, isSecure } = parseTripcode(nameField)
        if (password) {
          tripcode = await generateTripcode(password, isSecure)
        }
      }

      let publicUrl = ''
      if (imageFile) {
        const extension = imageFile instanceof File ? imageFile.name.split('.').pop() : 'png'
        const randomId = Math.random().toString(36).substring(2, 15)
        const uploadResult = await db.storage.upload(
          imageFile,
          `posts/${Date.now()}-${randomId}.${extension}`,
          { upsert: true }
        )
        publicUrl = uploadResult.url
        await saveToImageLibrary(publicUrl, imageFile instanceof File ? imageFile.name : 'canvas-upload.png', imageFile.size, user.id)
      }

      // Capture PoW data 
      const powData = getPoWValidationData()
      if (!powData) throw new Error('PoW data missing')

      // Use ATOMIC VALIDATE & CREATE endpoint (Fix 3 & 5)
      const { data: result, error: powError } = await invokeFunction<any>('validate-pow', {
        body: {
          ...powData,
          targetType: 'post',
          userId: user.id,
          createPostData: {
            threadId,
            content: content.trim(),
            imageUrl: publicUrl,
            username: finalUsername,
            tripcode: tripcode,
            countryCode: guessCountryCode()
          }
        }
      })

      if (powError || result?.valid === false) {
        throw new Error(result?.error || powError?.message || 'PoW validation failed')
      }

      const createdPostId = result.postId;

      // Create notifications (optional enhancement)
      if (createdPostId) {
        createNotificationsForPost(
           content, 
           threadId, 
           createdPostId, 
           user.id,
           undefined // parent ID can be resolved from content parser >>123
        ).catch(err => console.warn('Notification error:', err))
      }

      toast.success('Reply posted')

      // Bust caches so reply counts update immediately
      requestCache.invalidatePattern(/^threads-/)

      setContent('')
      setImageFile(null)
      setImagePreview(null)
      onSuccess?.()
      
      // Stop mining after success
      miningManagerRef.current.stopDedicatedMining()
      clearPoWValidationData()
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to post')
    } finally {
      setLoading(false)
      isSubmittingRef.current = false
    }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-0 p-4 z-50">
        <Button 
          onClick={() => setMinimized(false)}
          className="shadow-xl bg-primary text-primary-foreground border-2 border-foreground font-mono hover:bg-primary/80"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          Quick Reply
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 p-2 z-50 w-full max-w-sm">
      <div className="border border-border/40 shadow-2xl bg-card text-card-foreground font-mono">
        <div className="flex items-center justify-between bg-primary text-primary-foreground p-1 border-b border-border/20 cursor-move handle">
          <span className="font-bold text-[10px] uppercase tracking-widest">Quick Reply</span>
          <div className="flex gap-1">
            <button onClick={() => setMinimized(true)} className="hover:opacity-70"><Minimize2 className="w-3 h-3" /></button>
            <button onClick={onClose} className="hover:opacity-70"><X className="w-3 h-3" /></button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-2 space-y-2">
          <div className="flex gap-2">
            <input 
              placeholder="Name#trip" 
              value={nameField} 
              onChange={e => setNameField(e.target.value)}
              className="w-full text-[11px] h-6 bg-background border border-border/20 px-1 focus:outline-none focus:border-primary"
            />
          </div>
          
          <textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Comment"
            className="w-full text-[12px] min-h-[80px] bg-background border border-border/20 p-1 focus:outline-none focus:border-primary resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px]">
              <Checkbox 
                id="qr-anonymous" 
                checked={postAnonymously}
                onCheckedChange={(checked) => setPostAnonymously(checked === true)}
                className="h-3 w-3 border border-border/20"
              />
              <Label
                htmlFor="qr-anonymous"
                className="text-[10px] cursor-pointer"
              >
                POST ANON
              </Label>
            </div>
            
            {!hasValidPoW && (
              <div className="flex items-center gap-1 text-[9px] text-primary animate-pulse">
                <Loader2 className="w-2 h-2 animate-spin" />
                MINING PoW...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
             <div className="flex gap-1">
               <label htmlFor="qr-image" className="cursor-pointer border border-border/20 p-1 bg-background hover:bg-muted" title="Upload Image">
                 <ImageIcon className="w-3 h-3" />
               </label>
               <input 
                 ref={fileInputRef}
                 id="qr-image" 
                 type="file" 
                 className="hidden" 
                 onChange={handleImageChange}
               />

               <Dialog open={showCanvas} onOpenChange={setShowCanvas}>
                 <DialogTrigger asChild>
                   <button type="button" className="cursor-pointer border border-border/20 p-1 bg-background hover:bg-muted" title="Draw Image">
                     <Palette className="w-3 h-3" />
                   </button>
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

             {imagePreview && (
               <div className="relative">
                 <img src={imagePreview} className="h-6 w-6 object-cover border border-border/20" />
                 <button 
                   type="button"
                   onClick={() => { setImageFile(null); setImagePreview(null); }}
                   className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                 >
                   <X className="w-2 h-2" />
                 </button>
               </div>
             )}
             
             {!imagePreview && <span className="text-[9px] text-red-500 font-bold">* REQUIRED</span>}
             
             <div className="ml-auto flex items-center gap-2">
               <button 
                 type="submit" 
                 disabled={loading || !content.trim() || !imageFile || !hasValidPoW}
                 className="h-6 px-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
               >
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Post</>}
               </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  )
}
