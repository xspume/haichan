import { useState, useRef, useEffect } from 'react'
import { X, Minimize2, Maximize2, Image as ImageIcon, Send, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'
import { Card } from '../ui/card'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { parseTripcode, generateTripcode } from '../../lib/tripcode'
import { isValidImageForBoard, getImageValidationError } from '../../lib/image-validation'
import { saveToImageLibrary } from '../../lib/image-library'
import { fetchPostNumberWithPoW, getPoWValidationData } from '../../lib/pow-validation'
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [postAnonymously, setPostAnonymously] = useState(false)
  const { authState, siteSettings } = useAuth()
  
  // Mining state
  const [targetDifficulty, setTargetDifficulty] = useState({ prefix: '21e8', points: 15 })
  const hasValidPoW = usePoWValidity(targetDifficulty.prefix, targetDifficulty.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())
  const isSubmittingRef = useRef(false) // Prevent double submissions
  
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

      let publicUrl = null
      if (imageFile) {
        const extension = imageFile.name.split('.').pop()
        const randomId = Math.random().toString(36).substring(2, 15)
        const uploadResult = await db.storage.upload(
          imageFile,
          `posts/${Date.now()}-${randomId}.${extension}`,
          { upsert: true }
        )
        publicUrl = uploadResult.publicUrl
        await saveToImageLibrary(publicUrl, imageFile.name, imageFile.size, user.id)
      }

      // Capture PoW data BEFORE it's consumed by fetchPostNumberWithPoW
      const powData = getPoWValidationData()
      
      // Get post number (PoW REQUIRED)
      const nextPostNumber = await fetchPostNumberWithPoW(true)

      const postData: any = {
        threadId,
        userId: user.id,
        username: finalUsername,
        content: content.trim(),
        postNumber: nextPostNumber,
        countryCode: guessCountryCode(),
        totalPow: 0,
        createdAt: new Date().toISOString()
      }

      if (tripcode) postData.tripcode = tripcode
      if (publicUrl) postData.imageUrl = publicUrl
      if (replyTo) {
        try {
          const isNumeric = /^\d+$/.test(replyTo)
          const parent = await publicDb.db.posts.list({
            where: isNumeric
              ? { threadId, postNumber: Number(replyTo) }
              : { id: replyTo },
            limit: 1
          })
          if (parent?.[0]?.id) postData.parentPostId = parent[0].id
        } catch {
          // ignore
        }
      }
      
      const newPost = await db.db.posts.create(postData)

      // Update thread metadata for lists/sorting
      try {
        const threads = await publicDb.db.threads.list({ where: { id: threadId }, limit: 1 })
        const current = threads?.[0]
        await db.db.threads.update(threadId, {
          replyCount: (Number(current?.replyCount) || 0) + 1,
          lastPostAt: new Date().toISOString(),
          bumpOrder: Math.floor(Date.now() / 1000),
          updatedAt: new Date().toISOString()
        })
      } catch (e) {
        console.warn('[QuickReplyForm] Failed to update thread metadata:', e)
      }

      // Create notifications
      // We pass the new post ID (from SDK result usually, or just assume success if void)
      // The SDK create usually returns the object. 
      // If db-client.ts wrapper returns void, we might not have the ID.
      // Let's check db-client.ts or assume it returns the created object. 
      // Blink SDK `create` usually returns the object.
      
      if (newPost && newPost.id) {
        // Find the parent post ID if replyTo was a post number
        // Actually replyTo prop is usually the Post Number string in this form logic
        // But createNotificationsForPost handles number parsing from content.
        // If replyTo is an ID, we pass it. If it's a number, we let content parser handle it.
        // In ThreadDetailPage, we setReplyTo with postNumber.toString().
        // So we don't have the parent UUID easily here unless we look it up.
        // But createNotificationsForPost handles content parsing which covers >>123.
        // The replyTo prop helps pre-fill content.
        
        await createNotificationsForPost(
           content, 
           threadId, 
           newPost.id, 
           user.id,
           postData.parentPostId // Pass the resolved parentPostId
        )
      } else {
        // Fallback if create doesn't return ID (it should)
         console.warn('Post created but no ID returned, notifications might be skipped')
      }

      if (powData) {
        await invokeFunction('validate-pow', {
          body: {
            challenge: powData.challenge,
            nonce: powData.nonce,
            hash: powData.hash,
            points: powData.points,
            trailingZeros: powData.trailingZeros,
            prefix: powData.prefix,
            targetType: 'thread',
            targetId: threadId,
            userId: user.id
          }
        })
      }

      toast.success('Reply posted')

      // Bust caches so reply counts update immediately in board lists
      requestCache.invalidatePattern(/^threads-/)

      setContent('')
      setImageFile(null)
      setImagePreview(null)
      onSuccess?.()
      
      // Stop mining after success
      miningManagerRef.current.stopDedicatedMining()
      
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

          <div className="flex items-center gap-2">
             <label htmlFor="qr-image" className="cursor-pointer border border-border/20 p-1 bg-background hover:bg-muted">
               <ImageIcon className="w-3 h-3" />
             </label>
             <input 
               id="qr-image" 
               type="file" 
               className="hidden" 
               onChange={handleImageChange}
             />
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
             
             <div className="ml-auto flex items-center gap-2">
               <button 
                 type="submit" 
                 disabled={loading}
                 className="h-6 px-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-80 disabled:opacity-50"
               >
                 {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
               </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  )
}
