import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { 
  Paintbrush, 
  PaintBucket,
  Eraser, 
  Download,
  Image as ImageIcon,
  Users,
  Camera,
  Film,
  Trash2,
  Play,
  Square,
  Copy,
  Hash,
  Sparkles,
  Undo,
  Redo,
  Wand2,
  Upload,
  Circle,
  Star,
  ChevronDown,
  ChevronUp,
  Target, // Added for mask tool
  Type,
  PenTool,
  Pencil,
  Cloud,
  Wind,
  Layers,
  Zap // Added for PoW indicator
} from 'lucide-react'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import type { RealtimeChannel } from '@blinkdotnew/sdk'
import { saveToImageLibrary } from '../../lib/image-library'
import { generateGIFFromFrames, exportFrameSequence } from '../../lib/gif-encoder'
import { applyDithering } from '../../lib/dither'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { COLOR_PALETTES, TEXTURE_PRESETS, type ColorPalette } from '../../lib/doodle-presets'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { getPoWValidationData } from '../../lib/pow-validation'
import { invokeFunction } from '../../lib/functions-utils'

interface DrawAction {
  type: 'draw' | 'clear'
  x?: number
  y?: number
  color?: string
  size?: number
  tool?: 'brush' | 'eraser' | 'stamp' | 'bucket' | 'mask'
  brushStyle?: string
  selectedTexture?: string | null
  userId: string
  timestamp: number
}

interface CanvasFrame {
  dataUrl: string
  timestamp: number
}

export function MultiplayerCanvas() {
  const { authState } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const userMaskRef = useRef<HTMLCanvasElement>(null) // Track user-drawn areas
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState<'brush' | 'eraser' | 'stamp' | 'bucket' | 'mask'>('brush')
  const [brushStyle, setBrushStyle] = useState<'normal' | 'spray' | 'calligraphy' | 'marker' | 'pencil' | 'airbrush'>('normal')
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null)
  const [activePalette, setActivePalette] = useState<ColorPalette>(COLOR_PALETTES[0])
  const [stampType, setStampType] = useState<'circle' | 'square' | 'star'>('circle')
  const [tolerance, setTolerance] = useState(32)
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const [user, setUser] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [frames, setFrames] = useState<CanvasFrame[]>([])
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyStep, setHistoryStep] = useState(-1)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showToolbar, setShowToolbar] = useState(true)
  const [showMask, setShowMask] = useState(false)
  const [texturePatterns, setTexturePatterns] = useState<Map<string, CanvasPattern>>(new Map())
  
  // Session management
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  // PoW enforcement
  const CANVAS_DIFFICULTY = { prefix: '21e8', points: 15 }
  const hasValidPoW = usePoWValidity(CANVAS_DIFFICULTY.prefix, CANVAS_DIFFICULTY.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())

  // Dynamic canvas sizing
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 400 })

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth - 32 // padding
      const height = Math.round(width * 0.5) // 2:1 aspect ratio
      setCanvasSize({ width, height })
    }

    window.addEventListener('resize', updateSize)
    updateSize()
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Save current content if it exists
      let existingContent: ImageData | null = null
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          existingContent = ctx.getImageData(0, 0, canvas.width, canvas.height)
        } catch (e) {
          console.warn('Could not save canvas content before resize', e)
        }
      }

      // Set canvas size from state
      const oldWidth = canvas.width
      const oldHeight = canvas.height
      canvas.width = canvasSize.width
      canvas.height = canvasSize.height

      // Fill with white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Restore content if it existed
      if (existingContent && oldWidth > 0) {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = oldWidth
        tempCanvas.height = oldHeight
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.putImageData(existingContent, 0, 0)
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
        }
      }

      // Initialize user mask canvas (offscreen)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = canvas.width
      maskCanvas.height = canvas.height
      userMaskRef.current = maskCanvas
      
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      }

      setUser(authState.user)
      
      // Start background mining for canvas actions
      console.log('[MultiplayerCanvas] Starting dedicated mining for canvas actions...')
      miningManagerRef.current.startDedicatedMining('image', undefined, CANVAS_DIFFICULTY.points, CANVAS_DIFFICULTY.prefix)
        .catch(err => console.error('[MultiplayerCanvas] Mining error:', err))
    }

    initCanvas().catch(console.error)

    // Handle page unload/navigation to clean up WebSocket connection
    const handleBeforeUnload = () => {
      cleanup()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanup()
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [canvasSize])

  // Pre-load texture patterns
  useEffect(() => {
    TEXTURE_PRESETS.forEach(texture => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = texture.url
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const pattern = ctx.createPattern(img, 'repeat')
          if (pattern) {
            setTexturePatterns(prev => new Map(prev).set(texture.id, pattern))
          }
        }
      }
    })
  }, [])

  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const saveHistory = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(imageData)
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
  }

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1)
      restoreHistory(historyStep - 1)
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1)
      restoreHistory(historyStep + 1)
    }
  }

  const restoreHistory = (step: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = history[step]
    if (imageData) {
      ctx.putImageData(imageData, 0, 0)
    }
  }

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data, width, height } = imageData
    
    // Convert hex color to RGB
    const r = parseInt(fillColor.slice(1, 3), 16)
    const g = parseInt(fillColor.slice(3, 5), 16)
    const b = parseInt(fillColor.slice(5, 7), 16)
    
    const targetIdx = (startY * width + startX) * 4
    const startR = data[targetIdx]
    const startG = data[targetIdx + 1]
    const startB = data[targetIdx + 2]
    const startA = data[targetIdx + 3]

    // Don't fill if color is the same
    if (startR === r && startG === g && startB === b && startA === 255) return

    const stack: [number, number][] = [[startX, startY]]
    const seen = new Uint8Array(width * height)

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      if (seen[y * width + x]) continue
      
      const idx = (y * width + x) * 4
      const dr = Math.abs(data[idx] - startR)
      const dg = Math.abs(data[idx + 1] - startG)
      const db = Math.abs(data[idx + 2] - startB)
      const da = Math.abs(data[idx + 3] - startA)

      if (dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance) {
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
        seen[y * width + x] = 1

        if (x + 1 < width) stack.push([x + 1, y])
        if (x - 1 >= 0) stack.push([x - 1, y])
        if (y + 1 < height) stack.push([x, y + 1])
        if (y - 1 >= 0) stack.push([x, y - 1])
      }
    }

    ctx.putImageData(imageData, 0, 0)
    
    saveHistory()
  }

  const syncCanvas = () => {
    if (!channelRef.current || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    channelRef.current.publish('canvas_sync', { dataUrl, userId: authState.user?.id })
  }

  const applyDitheringEffect = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const ditheredData = applyDithering(imageData)
      ctx.putImageData(ditheredData, 0, 0)
      saveHistory()
      toast.success('Dithering applied')
    } catch (error) {
      console.error('Dithering failed:', error)
      toast.error('Failed to apply dithering')
    }
  }

  const loadImageToCanvas = (imageUrl: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Clear canvas
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw image to fit canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      saveHistory()
      toast.success('Image loaded as background')
    }
    img.onerror = () => {
      toast.error('Failed to load image')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    }
    img.src = imageUrl
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setBackgroundImage(imageUrl)
      loadImageToCanvas(imageUrl)
    }
    reader.readAsDataURL(file)
  }

  const drawStamp = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (selectedTexture && texturePatterns.has(selectedTexture)) {
      ctx.fillStyle = texturePatterns.get(selectedTexture)!
    } else {
      ctx.fillStyle = brushColor
    }
    ctx.strokeStyle = brushColor
    ctx.lineWidth = 2

    const size = brushSize * 3

    switch (stampType) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'square':
        ctx.fillRect(x - size, y - size, size * 2, size * 2)
        break
      case 'star':
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
          const radius = i % 2 === 0 ? size : size / 2
          ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle))
        }
        ctx.closePath()
        ctx.fill()
        break
    }
  }

  const generateAITexture = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a texture prompt')
      return
    }

    // Enforce PoW
    if (!hasValidPoW) {
      toast.error('PoW not ready. Please wait for valid hash to "pay" for AI generation.')
      return
    }

    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    // Check if user has drawn anything
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height)
    const hasDrawing = maskData.data.some((value, index) => {
      // Check alpha channel (every 4th value)
      return index % 4 === 3 && value > 0
    })

    if (!hasDrawing) {
      toast.error('Draw something first, then apply AI textures')
      return
    }

    setAiGenerating(true)
    const loadingToastId = toast.loading('Generating AI texture...')

    try {
      // 1. Submit PoW first
      const powData = getPoWValidationData()
      if (powData) {
        await invokeFunction('validate-pow', {
          body: {
            ...powData,
            targetType: 'image',
            targetId: 'canvas',
            userId: authState.user?.id
          }
        })
        miningManagerRef.current.clearLastPoWResult()
        // Restart mining for next action
        miningManagerRef.current.startDedicatedMining('image', undefined, CANVAS_DIFFICULTY.points, CANVAS_DIFFICULTY.prefix)
      }

      // Use user-provided prompt
      const prompt = aiPrompt.trim()
      
      // Generate COLOR image using AI
      const result = await db.ai.generateImage({
        prompt: `${prompt}, rich vibrant colors, high saturation, artistic texture, ${canvas.width}x${canvas.height} pixels`,
        n: 1
      })

      if (result.data && result.data[0]?.url) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Create temporary canvas for texture
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = canvas.width
            tempCanvas.height = canvas.height
            const tempCtx = tempCanvas.getContext('2d')
            
            if (tempCtx) {
              // Draw AI texture to temp canvas
              tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height)
              
              // Apply texture only to user-drawn areas using mask
              // Save current canvas state
              ctx.save()
              
              // Use mask as clipping region
              ctx.globalCompositeOperation = 'source-over'
              
              // Get the image data from both canvases
              const textureData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
              const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const maskImageData = maskCtx.getImageData(0, 0, canvas.width, canvas.height)
              
              // Apply texture only where mask has alpha > 0
              for (let i = 0; i < maskImageData.data.length; i += 4) {
                const maskAlpha = maskImageData.data[i + 3]
                if (maskAlpha > 0) {
                  // Copy texture color to canvas at this pixel
                  canvasData.data[i] = textureData.data[i]       // R
                  canvasData.data[i + 1] = textureData.data[i + 1] // G
                  canvasData.data[i + 2] = textureData.data[i + 2] // B
                  // Keep original alpha or use mask alpha
                  canvasData.data[i + 3] = Math.max(canvasData.data[i + 3], maskAlpha)
                }
              }
              
              // Put the modified image data back
              ctx.putImageData(canvasData, 0, 0)
              
              ctx.restore()
              
              toast.dismiss(loadingToastId)
              toast.success('Colorful AI textures applied to your drawing!')
            }
            resolve()
          }
          img.onerror = () => {
            toast.dismiss(loadingToastId)
            toast.error('Failed to load AI texture')
            reject(new Error('Image load failed'))
          }
          img.src = result.data[0].url
        })
      } else {
        throw new Error('No image generated')
      }
    } catch (error) {
      console.error('AI texture generation failed:', error)
      toast.dismiss(loadingToastId)
      toast.error('AI texture generation failed')
      
      // Fallback: generate colorful procedural pattern on user areas only
      generateFallbackPattern(ctx)
    } finally {
      setAiGenerating(false)
    }
  }

  const generateFallbackPattern = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return
    
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return
    
    // Get mask data
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height)
    const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Apply colorful random dots only to user-drawn areas
    for (let i = 0; i < maskData.data.length; i += 4) {
      const maskAlpha = maskData.data[i + 3]
      if (maskAlpha > 0) {
        // Generate random vibrant color
        const hue = Math.random() * 360
        const sat = 70 + Math.random() * 30
        const light = 50 + Math.random() * 20
        
        // Convert HSL to RGB
        const c = (1 - Math.abs(2 * light / 100 - 1)) * sat / 100
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
        const m = light / 100 - c / 2
        
        let r = 0, g = 0, b = 0
        if (hue < 60) { r = c; g = x; b = 0 }
        else if (hue < 120) { r = x; g = c; b = 0 }
        else if (hue < 180) { r = 0; g = c; b = x }
        else if (hue < 240) { r = 0; g = x; b = c }
        else if (hue < 300) { r = x; g = 0; b = c }
        else { r = c; g = 0; b = x }
        
        canvasData.data[i] = Math.round((r + m) * 255)
        canvasData.data[i + 1] = Math.round((g + m) * 255)
        canvasData.data[i + 2] = Math.round((b + m) * 255)
      }
    }
    
    ctx.putImageData(canvasData, 0, 0)
    toast.success('Colorful procedural pattern applied')
  }

  const startSession = async () => {
    // Check if user is authenticated first
    if (!user) {
      toast.error('Please sign in to start a session')
      return
    }
    
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    setSessionActive(true)
    setSessionStartTime(Date.now())
    setFrames([])
    
    // Clear the user mask for new session
    const maskCanvas = userMaskRef.current
    if (maskCanvas && canvasRef.current) {
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        maskCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
    
    // Don't auto-generate texture - let user draw first
    
    if (user) {
      await setupRealtimeChannel(user, newSessionId)
    }
    
    toast.success(`Session started: ${newSessionId.substring(0, 20)}...`)
  }

  const endSession = () => {
    // Clean up before marking session inactive to prevent race conditions
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    if (isRecording) {
      setIsRecording(false)
    }
    cleanup()
    
    // Mark session as inactive after cleanup to prevent reconnection attempts
    setSessionActive(false)
    setSessionStartTime(null)
    toast.success('Session ended')
  }

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId)
      toast.success('Session ID copied to clipboard')
    }
  }

  const setupRealtimeChannel = async (currentUser: any, sessionId: string) => {
    try {
      // Use session-scoped channel
      const channel = db.realtime.channel(`canvas-${sessionId}`)
      channelRef.current = channel

      // Subscribe to channel with user metadata
      await channel.subscribe({
        userId: currentUser.id,
        metadata: { 
          displayName: currentUser.username || currentUser.email,
          sessionId
        }
      })

      // Listen for draw actions from other users
      channel.onMessage((message) => {
        if (message.type === 'draw' && message.userId !== currentUser.id) {
          const action = message.data as DrawAction
          applyRemoteDrawAction(action)
        } else if (message.type === 'canvas_sync' && message.userId !== currentUser.id) {
          const { dataUrl } = message.data as { dataUrl: string }
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const img = new Image()
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            // No need to save history on remote sync
          }
          img.src = dataUrl
        }
      })

      // Track online users
      channel.onPresence((users) => {
        setOnlineUsers(users.length)
      })

      toast.success('Connected to session canvas')
    } catch (error: any) {
      // Handle subscription timeout gracefully - realtime is non-critical
      if (error?.name === 'BlinkRealtimeError' && error?.message?.includes('timeout')) {
        console.warn('Canvas realtime subscription timeout (non-critical)')
        toast('Real-time sync unavailable. Changes will sync on reload.')
        return // Don't show error toast for timeout
      }
      
      console.warn('Failed to setup realtime:', error?.message || error)
      
      // Provide user-friendly error message
      if (error instanceof Error && error.message.includes('auth')) {
        toast.error('Authentication required. Please sign in again.')
      } else if (error instanceof Error && error.message.includes('network')) {
        toast.error('Network error. Check your connection and retry.')
      } else {
        toast('Real-time sync unavailable. Changes will sync on reload.')
      }
      
      // Clean up failed connection
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe()
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
        channelRef.current = null
      }
    }
  }

  const cleanup = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe()
      } catch (error) {
        console.error('Error during channel cleanup:', error)
      } finally {
        channelRef.current = null
      }
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return
      }

      if (!sessionActive) return
      
      if (e.key === 'b' || e.key === 'B') {
        setTool('brush')
        e.preventDefault()
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser')
        e.preventDefault()
      } else if (e.key === 's' || e.key === 'S') {
        setTool('stamp')
        e.preventDefault()
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'g' || e.key === 'G') {
        setTool('bucket')
        e.preventDefault()
      } else if (e.key === 'm' || e.key === 'M') {
        setTool('mask')
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sessionActive])

  const applyRemoteDrawAction = (action: DrawAction) => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (action.type === 'clear') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Also clear mask
      maskCtx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    if (action.tool === 'bucket' && action.x !== undefined && action.y !== undefined) {
      floodFill(Math.round(action.x), Math.round(action.y), action.color || '#000000')
      return
    }

    if (action.x !== undefined && action.y !== undefined) {
      // Draw on main canvas
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = action.size || 3

      if (action.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        
        // Handle texture for remote action
        if (action.selectedTexture && texturePatterns.has(action.selectedTexture)) {
          ctx.strokeStyle = texturePatterns.get(action.selectedTexture)!
        } else {
          ctx.strokeStyle = action.color || '#000000'
        }

        // Apply remote brush style extensions
        if (action.brushStyle === 'spray') {
          for (let i = 0; i < 10; i++) {
            const offsetX = (Math.random() - 0.5) * (action.size || 3) * 2
            const offsetY = (Math.random() - 0.5) * (action.size || 3) * 2
            ctx.fillStyle = (action.selectedTexture && texturePatterns.has(action.selectedTexture)) 
              ? texturePatterns.get(action.selectedTexture)! 
              : (action.color || '#000000')
            ctx.fillRect(action.x + offsetX, action.y + offsetY, 2, 2)
          }
          // No return here, let it fall through to the general drawing logic if needed
        } else if (action.brushStyle === 'calligraphy') {
          ctx.lineWidth = (action.size || 3) * (0.5 + Math.random())
        } else if (action.brushStyle === 'marker') {
          ctx.globalAlpha = 0.5
          ctx.lineWidth = (action.size || 3) * 1.5
        } else if (action.brushStyle === 'pencil') {
          ctx.globalAlpha = 0.8
          ctx.lineWidth = Math.max(1, (action.size || 3) / 3)
        } else if (action.brushStyle === 'airbrush') {
          const gradient = ctx.createRadialGradient(action.x, action.y, 0, action.x, action.y, action.size || 3)
          const gColorRaw = (action.selectedTexture && texturePatterns.has(action.selectedTexture)) ? texturePatterns.get(action.selectedTexture)! : (action.color || '#000000')
          const gColor = typeof gColorRaw === 'string' ? gColorRaw : '#000000'
          gradient.addColorStop(0, gColor)
          gradient.addColorStop(1, 'transparent')
          ctx.fillStyle = gradient
          ctx.globalAlpha = 0.2
          ctx.fillRect(action.x - (action.size || 3), action.y - (action.size || 3), (action.size || 3) * 2, (action.size || 3) * 2)
          ctx.globalAlpha = 1.0
          // Return here as airbrush is a self-contained effect
          return
        }
      }

      ctx.beginPath()
      // For non-spray brush styles, draw a single point or line segment
      if (action.brushStyle !== 'spray') {
        if (ctx.lineWidth > 1) { // If it's a line, use lineTo
          ctx.moveTo(action.x, action.y) // Start point for line
        } else { // Otherwise, draw a single point
          ctx.arc(action.x, action.y, (action.size || 3) / 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      
      // If it's a line drawing (not a single point or spray), stroke it
      if (ctx.lineWidth > 1 && action.brushStyle !== 'spray' && action.brushStyle !== 'airbrush') {
        ctx.stroke()
      }
      
      // Reset alpha if it was modified
      if (action.brushStyle === 'marker' || action.brushStyle === 'pencil' || action.brushStyle === 'airbrush') {
        ctx.globalAlpha = 1.0
      }
      
      // Also update mask
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.lineWidth = action.size || 3
      
      if (action.tool === 'eraser') {
        maskCtx.globalCompositeOperation = 'destination-out'
      } else {
        maskCtx.globalCompositeOperation = 'source-over'
        maskCtx.fillStyle = '#000000'
      }
      
      // Apply drawing to mask
      if (action.brushStyle === 'spray') {
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * (action.size || 3) * 2
          const offsetY = (Math.random() - 0.5) * (action.size || 3) * 2
          maskCtx.fillRect(action.x + offsetX, action.y + offsetY, 2, 2)
        }
      } else if (action.brushStyle === 'airbrush') {
        // Airbrush doesn't directly affect the mask in the same way, but we can approximate
        // or decide not to mask airbrush effects if they are purely visual.
        // For now, let's skip masking airbrush for simplicity.
      } else {
        maskCtx.beginPath()
        if (action.brushStyle !== 'spray') { // Avoid re-drawing spray on mask
          if (maskCtx.lineWidth > 1) {
            maskCtx.moveTo(action.x, action.y)
          } else {
            maskCtx.arc(action.x, action.y, (action.size || 3) / 2, 0, Math.PI * 2)
            maskCtx.fill()
          }
        }
        if (maskCtx.lineWidth > 1 && action.brushStyle !== 'spray' && action.brushStyle !== 'airbrush') {
          maskCtx.stroke()
        }
      }
    }
  }

  const broadcastDrawAction = async (action: Omit<DrawAction, 'userId' | 'timestamp'>) => {
    if (!channelRef.current || !user) return

    const fullAction: DrawAction = {
      ...action,
      userId: user.id,
      timestamp: Date.now()
    }

    try {
      await channelRef.current.publish('draw', fullAction)
    } catch (error) {
      console.error('Failed to broadcast draw action:', error)
    }
  }

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else if ('clientX' in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!sessionActive) return
    e.preventDefault()
    const point = getCanvasPoint(e)
    if (!point) return

    setIsDrawing(true)
    setLastPosition(point)
    draw(point.x, point.y, true)
  }

  const draw = useCallback((x: number, y: number, isStart: boolean = false) => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (tool === 'stamp') {
      drawStamp(x, y)
      broadcastDrawAction({
        type: 'draw',
        x,
        y,
        color: brushColor,
        size: brushSize,
        tool: 'stamp',
        selectedTexture // Add this
      })
      return
    }

    if (tool === 'bucket') {
      if (selectedTexture && texturePatterns.has(selectedTexture)) {
        const pattern = texturePatterns.get(selectedTexture)!
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        saveHistory()
      } else {
        floodFill(Math.round(x), Math.round(y), brushColor)
      }
      
      broadcastDrawAction({
        type: 'draw',
        x,
        y,
        color: brushColor,
        tool: 'bucket',
        selectedTexture // Add this
      })
      return
    }

    // Handle mask tool
    if (tool === 'mask') {
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.lineWidth = brushSize
      maskCtx.strokeStyle = '#ff0000' // Red mask for visibility
      maskCtx.globalCompositeOperation = 'source-over'
      
      if (isStart) {
        maskCtx.beginPath()
        maskCtx.moveTo(x, y)
      } else {
        maskCtx.lineTo(x, y)
        maskCtx.stroke()
      }
      return
    }

    // Draw on main canvas
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      
      if (selectedTexture && texturePatterns.has(selectedTexture)) {
        ctx.strokeStyle = texturePatterns.get(selectedTexture)!
      } else {
        ctx.strokeStyle = brushColor
      }

      // Apply brush style extensions
      if (brushStyle === 'spray') {
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2
          const offsetY = (Math.random() - 0.5) * brushSize * 2
          ctx.fillStyle = selectedTexture ? texturePatterns.get(selectedTexture)! : brushColor
          ctx.fillRect(x + offsetX, y + offsetY, 2, 2)
        }
        // Update mask for spray
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2
          const offsetY = (Math.random() - 0.5) * brushSize * 2
          maskCtx.fillStyle = '#000000'
          maskCtx.fillRect(x + offsetX, y + offsetY, 2, 2)
        }
        broadcastDrawAction({
          type: 'draw',
          x,
          y,
          color: brushColor,
          size: brushSize,
          tool: 'brush',
          brushStyle,
          selectedTexture
        })
        return
      } else if (brushStyle === 'calligraphy') {
        // Calligraphy effect (variable width)
        ctx.lineWidth = brushSize * (0.5 + Math.random())
      } else if (brushStyle === 'marker') {
        ctx.globalAlpha = 0.5
        ctx.lineWidth = brushSize * 1.5
      } else if (brushStyle === 'pencil') {
        ctx.globalAlpha = 0.8
        ctx.lineWidth = Math.max(1, brushSize / 3)
      } else if (brushStyle === 'airbrush') {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize)
        const gColorRaw = selectedTexture ? texturePatterns.get(selectedTexture)! : brushColor
        const gColor = typeof gColorRaw === 'string' ? gColorRaw : brushColor
        gradient.addColorStop(0, gColor)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.globalAlpha = 0.2
        ctx.fillRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2)
        ctx.globalAlpha = 1.0
        // Broadcast airbrush action
        broadcastDrawAction({
          type: 'draw',
          x,
          y,
          color: brushColor,
          size: brushSize,
          tool: 'brush',
          brushStyle,
          selectedTexture
        })
        return
      }
    } else {
      ctx.globalCompositeOperation = 'destination-out'
    }

    if (isStart) {
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    // Also update mask canvas to track user-drawn areas
    maskCtx.lineCap = 'round'
    maskCtx.lineJoin = 'round'
    maskCtx.lineWidth = brushSize

    if (tool === 'brush') {
      maskCtx.globalCompositeOperation = 'source-over'
      maskCtx.fillStyle = '#000000' // Just track the area
      
      if (isStart) {
        maskCtx.beginPath()
        maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
        maskCtx.fill()
      } else {
        maskCtx.strokeStyle = '#000000'
        maskCtx.lineTo(x, y)
        maskCtx.stroke()
      }
    } else {
      // Eraser also erases from mask
      maskCtx.globalCompositeOperation = 'destination-out'
      
      if (isStart) {
        maskCtx.beginPath()
        maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
        maskCtx.fill()
      } else {
        maskCtx.lineTo(x, y)
        maskCtx.stroke()
      }
    }

    // Broadcast to other users
    broadcastDrawAction({
      type: 'draw',
      x,
      y,
      color: brushColor,
      size: brushSize,
      tool,
      brushStyle,
      selectedTexture
    })
  }, [brushColor, brushSize, tool, brushStyle, selectedTexture, texturePatterns, stampType, tolerance, drawStamp, floodFill, broadcastDrawAction])

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const point = getCanvasPoint(e)
    if (!point) return

    if (lastPosition) {
      const steps = Math.max(Math.abs(point.x - lastPosition.x), Math.abs(point.y - lastPosition.y))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = lastPosition.x + (point.x - lastPosition.x) * t
        const y = lastPosition.y + (point.y - lastPosition.y) * t
        draw(x, y, i === 0)
      }
    } else {
      draw(point.x, point.y)
    }

    setLastPosition(point)
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setLastPosition(null)
    }
  }

  const clearCanvas = () => {
    // Only require PoW if canvas is not empty
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (confirm('Wipe core memory and clear entire canvas?')) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Also clear user mask
        if (userMaskRef.current) {
          const maskCtx = userMaskRef.current.getContext('2d')
          maskCtx?.clearRect(0, 0, canvas.width, canvas.height)
        }
        
        saveHistory()
        syncCanvas()
        toast.success('Core wiped')
      }
    }
  }

  const captureFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    setFrames(prev => [...prev, { dataUrl, timestamp: Date.now() }])
  }, [])

  const startRecording = () => {
    if (!sessionActive) {
      toast.error('Start a session first')
      return
    }
    setIsRecording(true)
    setFrames([])
    
    // Capture initial frame
    captureFrame()
    
    // Capture frame every 100ms
    frameIntervalRef.current = setInterval(captureFrame, 100)
    
    toast.success('Recording started')
  }

  const stopRecording = () => {
    setIsRecording(false)
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    
    toast.success(`Recording stopped. ${frames.length} frames captured`)
  }

  const saveSnapshot = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Enforce PoW
    if (!hasValidPoW) {
      toast.error('PoW required to save snapshot to library.')
      return
    }

    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })

      if (!user) {
        toast.error('Please sign in first')
        return
      }

      const filename = `canvas-snapshot-${Date.now()}.png`
      const { publicUrl } = await db.storage.upload(blob as File, `canvas/${user.id}/${filename}`, {
        upsert: true
      })
      
      // 1. Submit PoW to link it properly
      const powData = getPoWValidationData()
      if (powData) {
        await invokeFunction('validate-pow', {
          body: {
            ...powData,
            targetType: 'image',
            targetId: 'snapshot',
            userId: user.id
          }
        })
        miningManagerRef.current.clearLastPoWResult()
        miningManagerRef.current.startDedicatedMining('image', undefined, CANVAS_DIFFICULTY.points, CANVAS_DIFFICULTY.prefix)
      }

      // Save to image library
      await saveToImageLibrary(publicUrl, filename, blob.size, user.id)

      toast.success('Snapshot saved to library')
    } catch (error) {
      console.error('Failed to save snapshot:', error)
      toast.error('Failed to save snapshot')
    }
  }

  const exportCanvas = async () => { // Renamed from exportAsGIF for broader use
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (!user) {
      toast.error('Please sign in first')
      return
    }

    if (isRecording && frames.length < 2) {
      toast.error('Need at least 2 frames to create GIF')
      return
    }

    setIsExporting(true)
    const loadingToast = toast.loading('Exporting...')

    try {
      if (isRecording && frames.length >= 2) {
        // Generate GIF from frames
        const gifBlob = await generateGIFFromFrames({
          width: canvas.width,
          height: canvas.height,
          frames: frames.map(f => f.dataUrl),
          delay: 100,
          quality: 10
        })

        toast.dismiss(loadingToast)
        toast.loading('Uploading GIF to storage...')

        const filename = `canvas-session-${sessionId?.substring(0, 12)}-${Date.now()}.gif`
        const { publicUrl } = await db.storage.upload(gifBlob as File, `canvas/${user.id}/${filename}`, {
          upsert: true
        })
        
        // Save to image library
        await saveToImageLibrary(publicUrl, filename, gifBlob.size, user.id)

        toast.dismiss()
        toast.success(`Animated GIF exported with ${frames.length} frames`)
        
        // Clear frames
        setFrames([])
      } else {
        // Download as PNG
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png')
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `canvas-${sessionId || Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.dismiss(loadingToast)
        toast.success('Canvas downloaded as PNG')
      }
    } catch (error) {
      console.error('Failed to export:', error)
      toast.dismiss(loadingToast)
      
      // Fallback: export as frame sequence JSON if GIF export failed
      if (isRecording && frames.length >= 2) {
        try {
          toast.loading('Exporting as frame sequence (fallback)...')
          const sequenceBlob = exportFrameSequence(frames.map(f => f.dataUrl))
          const filename = `canvas-session-${sessionId?.substring(0, 12)}-${Date.now()}.json`
          const { publicUrl } = await db.storage.upload(sequenceBlob as File, `canvas/${user.id}/${filename}`, {
            upsert: true
          })
          
          await saveToImageLibrary(publicUrl, filename, sequenceBlob.size, user.id)
          
          toast.dismiss()
          toast.success(`Frame sequence exported with ${frames.length} frames`)
          setFrames([])
        } catch (fallbackError) {
          console.error('Fallback export also failed:', fallbackError)
          toast.error('Failed to export. Please try again.')
        }
      } else {
        toast.error('Failed to export. Please try again.')
      }
    } finally {
      setIsExporting(false)
      if (isRecording) setIsRecording(false) // Stop recording after export attempt
    }
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `canvas-${sessionId || Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Canvas downloaded')
    })
  }

  return (
    <div className="flex flex-col h-full bg-background font-mono text-primary select-none overflow-hidden border-2 border-primary shadow-3d" ref={containerRef}>
      {/* Top Controls Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-primary bg-primary/5">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Canvas Sync</span>
            <span className="text-xs font-black flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", sessionActive ? "bg-primary animate-pulse" : "bg-red-500")} />
              {sessionActive ? "UPLINK_ESTABLISHED" : "OFFLINE"}
            </span>
          </div>
          
          <div className="h-8 w-px bg-primary/20" />
          
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Pulse Sync</span>
            <span className="text-xs font-black flex items-center gap-1">
              <Users className="w-3 h-3" />
              {onlineUsers} NODES
            </span>
          </div>

          <div className="h-8 w-px bg-primary/20" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Action Energy</span>
            <div className={`px-2 py-0.5 border text-[9px] font-mono flex items-center gap-1.5 ${
              hasValidPoW ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-primary/5 border-foreground/20 text-foreground/60'
            }`}>
              <Zap size={10} className={hasValidPoW ? 'text-green-400' : 'animate-pulse'} />
              <span>{hasValidPoW ? 'PoW READY' : dedicatedSession ? 'MINING...' : 'STOPPED'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-[10px] font-black animate-pulse uppercase tracking-widest">
              <Film className="w-3 h-3" />
              Rec: {frames.length} Fr
            </div>
          )}
          
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={undo} 
              disabled={historyStep <= 0}
              className="h-8 w-8 p-0 border border-primary/30 hover:bg-primary hover:text-background disabled:opacity-30 transition-all"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={redo} 
              disabled={historyStep >= history.length - 1}
              className="h-8 w-8 p-0 border border-primary/30 hover:bg-primary hover:text-background disabled:opacity-30 transition-all"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Slender Left Toolbar */}
        <aside className="w-14 border-r-2 border-primary bg-background flex flex-col items-center py-4 gap-4 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-2">
            {[
              { id: 'brush', icon: <Paintbrush className="w-5 h-5" />, label: 'BRUSH' },
              { id: 'bucket', icon: <PaintBucket className="w-5 h-5" />, label: 'FILL' },
              { id: 'eraser', icon: <Eraser className="w-5 h-5" />, label: 'ERASE' },
              { id: 'stamp', icon: <Star className="w-5 h-5" />, label: 'STAMP' },
              { id: 'mask', icon: <Target className="w-5 h-5" />, label: 'MASK' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                className={cn(
                  "w-10 h-10 flex items-center justify-center border-2 transition-all group relative",
                  tool === t.id 
                    ? "bg-primary text-background border-primary shadow-3d-sm translate-x-[2px]" 
                    : "border-transparent hover:border-primary/50 text-primary/60 hover:text-primary"
                )}
                title={t.label}
              >
                {t.icon}
                {tool === t.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-background" />
                )}
              </button>
            ))}
          </div>

          <div className="w-8 h-px bg-primary/20" />

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={cn(
                "w-10 h-10 flex items-center justify-center border-2 transition-all",
                showAiPanel ? "bg-primary text-background border-primary shadow-3d-sm" : "border-transparent hover:border-primary/50 text-primary/60 hover:text-primary"
              )}
              title="AI TEXTURE"
            >
              <Wand2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "w-10 h-10 flex items-center justify-center border-2 transition-all",
                isRecording ? "bg-red-600 text-white border-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)]" : "border-transparent hover:border-primary/50 text-primary/60 hover:text-primary"
              )}
              title="RECORD GIF"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 bg-primary/5 relative flex items-center justify-center overflow-hidden p-4">
          <div className="relative shadow-3d-lg border-4 border-primary bg-muted">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={onMove} // Changed from draw to onMove
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing} // Changed from onMouseLeave to onMouseOut
              onTouchStart={startDrawing}
              onTouchMove={onMove} // Changed from draw to onMove
              onTouchEnd={stopDrawing}
              className={cn(
                "max-w-full h-auto",
                tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
              )}
              style={{ width: canvasSize.width, height: canvasSize.height }}
            />
            {showMask && (
              <canvas
                ref={userMaskRef}
                className="absolute inset-0 pointer-events-none opacity-30"
                style={{ width: canvasSize.width, height: canvasSize.height }}
              />
            )}
          </div>
        </main>

        {/* Right Properties Panel */}
        <aside className="w-48 border-l-2 border-primary bg-background/50 flex flex-col gap-6 p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Color Palette</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-8 text-[10px] font-black uppercase border-primary/50">
                  {activePalette.name}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-background border-primary/30">
                {COLOR_PALETTES.map((palette) => (
                  <DropdownMenuItem
                    key={palette.name}
                    onClick={() => setActivePalette(palette)}
                    className="text-[10px] font-black uppercase cursor-pointer"
                  >
                    {palette.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="grid grid-cols-4 gap-1">
              {activePalette.colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setBrushColor(c)}
                  className={cn(
                    "w-full aspect-square border-2 border-primary/20 hover:border-primary transition-all",
                    brushColor === c ? "border-primary scale-110 shadow-3d-sm" : ""
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Input 
              type="color" 
              value={brushColor} 
              onChange={(e) => setBrushColor(e.target.value)}
              className="h-8 p-1 rounded-none border-primary/50 bg-primary/5"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Vector Size</Label>
              <span className="text-[10px] font-black tabular-nums">{brushSize}px</span>
            </div>
            <Slider
              value={[brushSize]}
              onValueChange={(v) => setBrushSize(v[0])}
              max={50}
              min={1}
              step={1}
              className="py-2"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Brush Profile</Label>
            <div className="grid grid-cols-1 gap-1">
              {['normal', 'spray', 'calligraphy', 'marker', 'pencil', 'airbrush'].map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushStyle(s as any)}
                  className={cn(
                    "px-2 py-1.5 text-[9px] font-black uppercase border transition-all text-left",
                    brushStyle === s 
                      ? "bg-primary text-background border-primary shadow-3d-sm" 
                      : "border-primary/20 hover:border-primary/50"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest opacity-60">Texture Patterns</Label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setSelectedTexture(null)}
                className={cn(
                  "w-full aspect-square border-2 transition-all flex items-center justify-center text-[10px] font-bold",
                  selectedTexture === null
                    ? "border-primary scale-110 shadow-3d-sm"
                    : "border-primary/20 hover:border-primary/50"
                )}
                title="No Texture"
              >
                SOLID
              </button>
              {TEXTURE_PRESETS.map((texture) => (
                <button
                  key={texture.id}
                  onClick={() => setSelectedTexture(texture.id)}
                  className={cn(
                    "w-full aspect-square border-2 transition-all flex items-center justify-center",
                    selectedTexture === texture.id
                      ? "border-primary scale-110 shadow-3d-sm"
                      : "border-primary/20 hover:border-primary/50"
                  )}
                  title={texture.name}
                >
                  <Layers className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <Button onClick={clearCanvas} variant="destructive" size="sm" className="w-full rounded-none h-8 text-[10px] font-black uppercase">
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Wipe Core
            </Button>
            <Button onClick={exportCanvas} variant="outline" size="sm" className="w-full rounded-none h-8 text-[10px] font-black uppercase border-primary/50">
              <Download className="w-3.5 h-3.5 mr-2" />
              Extract Image
            </Button>
          </div>
        </aside>
      </div>

      {/* AI Panel Overlay */}
      {showAiPanel && (
        <div className="absolute top-16 right-52 w-64 card-3d p-4 bg-background/95 backdrop-blur-sm z-[55] space-y-4">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest">Texture Engine</span>
            <Wand2 className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] uppercase opacity-60">Diffusion Prompt</Label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="oil painting, cybernetic..."
              className="w-full h-20 bg-primary/5 border border-primary/30 p-2 text-[10px] font-mono focus:border-primary outline-none custom-scrollbar"
            />
          </div>
          <Button 
            onClick={generateAITexture} 
            disabled={aiGenerating}
            className="w-full btn-3d h-10 text-[10px]"
          >
            {aiGenerating ? 'SYNTHESIZING...' : 'INJECT TEXTURE'}
          </Button>
        </div>
      )}
    </div>
  )
}
