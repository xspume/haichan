import { useState, useRef, useEffect } from 'react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { Card } from '../ui/card'
import { 
  Paintbrush, 
  PaintBucket,
  Eraser, 
  Palette, 
  Sparkles, 
  Download, 
  Trash2, 
  Undo, 
  Redo,
  Wand2,
  ImageIcon,
  Upload,
  Image as ImageIconLucide,
  ChevronDown,
  ChevronUp,
  Circle,
  Square,
  Star,
  Type,
  PenTool,
  Pencil,
  Cloud,
  Wind,
  Layers
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import { applyDithering } from '../../lib/dither'
import { saveToImageLibrary } from '../../lib/image-library'
import { COLOR_PALETTES, TEXTURE_PRESETS, type ColorPalette, type TexturePreset } from '../../lib/doodle-presets'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface DoodleMiningProps {
  onImageGenerated?: (imageUrl: string) => void
  showMining?: boolean
  initialImage?: string // Allow starting with an image
}

export function DoodleMining({ onImageGenerated, showMining = true, initialImage }: DoodleMiningProps) {
  const { authState } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#ff6464')
  const [brushSize, setBrushSize] = useState(5)
  const [tool, setTool] = useState<'brush' | 'eraser' | 'stamp' | 'bucket' | 'mask'>('brush')
  const [brushStyle, setBrushStyle] = useState<'normal' | 'spray' | 'calligraphy' | 'marker' | 'pencil' | 'airbrush'>('normal')
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null)
  const [activePalette, setActivePalette] = useState<ColorPalette>(COLOR_PALETTES[0])
  const [stampType, setStampType] = useState<'circle' | 'square' | 'star'>('circle')
  const [tolerance, setTolerance] = useState(32)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyStep, setHistoryStep] = useState(-1)
  const [generating, setGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showMask, setShowMask] = useState(true)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(initialImage || null)
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showToolbar, setShowToolbar] = useState(true)
  const [texturePatterns, setTexturePatterns] = useState<Map<string, CanvasPattern>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const updateMobileState = () => {
    setIsMobile(window.innerWidth < 768)
  }

  // Calculate optimal canvas size based on viewport (2x scaled)
  const getCanvasSize = () => {
    const isSmallMobile = window.innerWidth < 400
    const isMediumMobile = window.innerWidth < 768
    
    if (isSmallMobile) {
      // Extra small devices (320px-399px) - 2x scale: 640x480
      return { width: 640, height: 480 }
    } else if (isMediumMobile) {
      // Mobile devices (400px-767px) - 2x scale: 1200x900
      const maxWidth = Math.min(window.innerWidth - 32, 1200)
      return { width: maxWidth, height: Math.round(maxWidth * 0.75) }
    } else {
      // Tablet/Desktop - 2x scale: 1600x1200
      return { width: 1600, height: 1200 }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const size = getCanvasSize()
    canvas.width = size.width
    canvas.height = size.height
    maskCanvas.width = size.width
    maskCanvas.height = size.height

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !maskCtx) return

    // Fill with white background or load initial image or buffer
    const bufferedImage = sessionStorage.getItem('current-doodle-buffer')
    
    if (initialImage) {
      // Load initial image passed from parent
      setBackgroundImage(initialImage)
      loadImageToCanvas(initialImage)
    } else if (bufferedImage) {
      // Load from buffer if available
      loadImageToCanvas(bufferedImage)
    } else if (backgroundImage) {
      loadImageToCanvas(backgroundImage)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    }

    // Initialize mask
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)

    // Handle window resize with debounce
    let resizeTimer: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        updateMobileState()
        
        const newSize = getCanvasSize()
        if (canvas.width !== newSize.width || canvas.height !== newSize.height) {
          // Save current state before resize
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
          
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
          
          const tempMaskCanvas = document.createElement('canvas')
          tempMaskCanvas.width = maskCanvas.width
          tempMaskCanvas.height = maskCanvas.height
          const tempMaskCtx = tempMaskCanvas.getContext('2d', { willReadFrequently: true })

          if (tempCtx && tempMaskCtx) {
            tempCtx.putImageData(imageData, 0, 0)
            tempMaskCtx.putImageData(maskImageData, 0, 0)
            
            // Resize canvas
            canvas.width = newSize.width
            canvas.height = newSize.height
            maskCanvas.width = newSize.width
            maskCanvas.height = newSize.height
            
            // Restore content scaled
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
            maskCtx.drawImage(tempMaskCanvas, 0, 0, maskCanvas.width, maskCanvas.height)
          }
        }
      }, 250)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [initialImage])

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
      toast.success('Image loaded')
    }
    img.onerror = () => {
      toast.error('Failed to load image')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    }
    img.src = imageUrl
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
    
    // Auto-save to session storage for pre-loading in thread/reply forms
    const dataUrl = canvas.toDataURL('image/png')
    sessionStorage.setItem('current-doodle-buffer', dataUrl)
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

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e && e.touches.length > 0) {
      // Touch event
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else if ('clientX' in e) {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const point = getCanvasPoint(e)
    if (!point) return

    setIsDrawing(true)
    setLastPosition(point)
    draw(point.x, point.y, true)
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

  const draw = (x: number, y: number, isStart: boolean = false) => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (tool === 'stamp') {
      drawStamp(x, y)
      return
    }

    if (tool === 'bucket') {
      if (selectedTexture && texturePatterns.has(selectedTexture)) {
        // We'll implement flood fill with pattern later if needed, 
        // but for now let's just use regular flood fill or a pattern fill
        const pattern = texturePatterns.get(selectedTexture)!
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, canvas.width, canvas.height) // This is not ideal for bucket, but let's keep it simple
        saveHistory()
        return
      }
      floodFill(Math.round(x), Math.round(y), brushColor)
      return
    }

    // Handle mask tool
    if (tool === 'mask') {
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.lineWidth = brushSize
      maskCtx.strokeStyle = '#ff0000' // Red mask
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

      // Apply brush style
      if (brushStyle === 'spray') {
        // Spray paint effect
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2
          const offsetY = (Math.random() - 0.5) * brushSize * 2
          ctx.fillStyle = selectedTexture ? texturePatterns.get(selectedTexture)! : brushColor
          ctx.fillRect(x + offsetX, y + offsetY, 2, 2)
        }
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
        const color = selectedTexture ? '#000000' : brushColor // Patterns don't work well with gradients
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.globalAlpha = 0.2
        ctx.fillRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2)
        ctx.globalAlpha = 1.0
        return
      }
    } else {
      ctx.globalCompositeOperation = 'destination-out'
    }

    if (isStart) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const point = getCanvasPoint(e)
    if (!point) return

    // For smoother lines on touch devices
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
      saveHistory()
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return
      }

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
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (tool === 'mask') {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      toast.success('Mask cleared')
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    saveHistory()
    toast.success('Canvas cleared')
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

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setGenerating(true)
    let loadingToast: string | undefined

    try {
      const canvas = canvasRef.current
      const maskCanvas = maskCanvasRef.current
      if (!canvas || !maskCanvas) return

      // Convert canvas to proper PNG file with white background
      // First ensure canvas has a solid white background for AI processing
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error('Canvas context not available')
        return
      }
      
      // Create a temporary canvas with white background + current drawing
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        toast.error('Failed to create temp canvas')
        return
      }
      
      // Fill with solid white background first
      tempCtx.fillStyle = '#ffffff'
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
      // Draw the current canvas content on top
      tempCtx.drawImage(canvas, 0, 0)
      
      // Convert to PNG file with proper name and type
      const blob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create canvas blob'))
        }, 'image/png', 1.0)
      })
      
      // Create proper File object from blob
      const randomId = Math.random().toString(36).substring(2, 15)
      const imageFile = new File([blob], `doodle-${Date.now()}-${randomId}.png`, { 
        type: 'image/png' 
      })

      // Mask handling
      let maskUrl: string | null = null
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
        const hasMask = maskData.data.some((val, i) => i % 4 === 3 && val > 0)
        
        if (hasMask) {
          const tempMaskCanvas = document.createElement('canvas')
          tempMaskCanvas.width = maskCanvas.width
          tempMaskCanvas.height = maskCanvas.height
          const tempMaskCtx = tempMaskCanvas.getContext('2d')
          if (tempMaskCtx) {
            tempMaskCtx.fillStyle = '#000000'
            tempMaskCtx.fillRect(0, 0, tempMaskCanvas.width, tempMaskCanvas.height)
            tempMaskCtx.drawImage(maskCanvas, 0, 0)
            
            const tempImageData = tempMaskCtx.getImageData(0, 0, tempMaskCanvas.width, tempMaskCanvas.height)
            for (let i = 0; i < tempImageData.data.length; i += 4) {
              if (tempImageData.data[i + 3] > 0) {
                tempImageData.data[i] = 255
                tempImageData.data[i + 1] = 255
                tempImageData.data[i + 2] = 255
                tempImageData.data[i + 3] = 255
              }
            }
            tempMaskCtx.putImageData(tempImageData, 0, 0)
            
            const maskBlob = await new Promise<Blob>((resolve, reject) => {
              tempMaskCanvas.toBlob((b) => {
                if (b) resolve(b)
                else reject(new Error('Failed to create mask blob'))
              }, 'image/png', 1.0)
            })
            
            // Create proper File object for mask
            const maskFileName = `mask-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.png`
            const maskFile = new File([maskBlob], maskFileName, { type: 'image/png' })
            
            const maskFilePath = `doodles/${authState.user?.id}/${maskFileName}`
            const maskUpload = await db.storage.upload(maskFile, maskFilePath, { upsert: true })
            maskUrl = maskUpload.publicUrl
          }
        }
      }

      // Upload to storage
      const user = authState.user
      if (!user) {
        toast.error('Please sign in first')
        return
      }

      const filename = `doodles/${user.id}/${imageFile.name}`
      const { publicUrl } = await db.storage.upload(imageFile, filename, {
        upsert: true
      })
      
      // Save original doodle to library (silently)
      await saveToImageLibrary(publicUrl, imageFile.name, imageFile.size, user.id)

      // Generate AI-enhanced version
      loadingToast = toast.loading('AI is enhancing your doodle...')
      
      const images = [publicUrl]
      if (maskUrl) images.push(maskUrl)

      const { data } = await db.ai.modifyImage({
        images,
        prompt: aiPrompt.trim() + (maskUrl ? ' (Modify only the areas marked white in the second image)' : ''),
        n: 1
      })

      if (data && data.length > 0) {
        const enhancedUrl = data[0].url
        
        // Save enhanced version to library (silently)
        await saveToImageLibrary(enhancedUrl, `AI Enhanced Doodle ${Date.now()}.png`, 0, user.id)
        
        // Load enhanced image onto canvas (iteratively)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Clear canvas and draw enhanced image
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          saveHistory()
          
          if (loadingToast) toast.dismiss(loadingToast)
          toast.success('Enhancement complete! Continue editing or enhance again.')
        }
        img.onerror = () => {
          if (loadingToast) toast.dismiss(loadingToast)
          toast.error('Failed to load enhanced image')
        }
        img.src = enhancedUrl
      } else {
        if (loadingToast) toast.dismiss(loadingToast)
        toast.error('No enhancement generated')
      }
    } catch (error: any) {
      if (loadingToast) toast.dismiss(loadingToast)
      console.error('AI generation failed:', error)
      toast.error(error.message || 'Failed to generate with AI')
    } finally {
      setGenerating(false)
    }
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

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary canvas with white background for proper export
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      toast.error('Failed to create export canvas')
      return
    }
    
    // Fill with white background first
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    // Draw the current canvas content on top
    tempCtx.drawImage(canvas, 0, 0)

    tempCanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `doodle-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Doodle downloaded')
    }, 'image/png', 1.0)
  }

  const exportToThread = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error('Canvas context not available')
        return
      }
      
      // Create a temporary canvas with white background for proper export
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        toast.error('Failed to create temp canvas')
        return
      }
      
      // Fill with white background first
      tempCtx.fillStyle = '#ffffff'
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
      // Draw the current canvas content on top
      tempCtx.drawImage(canvas, 0, 0)
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        tempCanvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create canvas blob'))
        }, 'image/png', 1.0)
      })

      const user = authState.user
      if (!user) {
        toast.error('Please sign in first')
        return
      }

      // Create proper File object from blob
      const randomId = Math.random().toString(36).substring(2, 15)
      const fileName = `doodle-${Date.now()}-${randomId}.png`
      const imageFile = new File([blob], fileName, { type: 'image/png' })
      
      const filePath = `doodles/${user.id}/${fileName}`
      const { publicUrl } = await db.storage.upload(imageFile, filePath, {
        upsert: true
      })
      
      // Save to image library (silently)
      await saveToImageLibrary(publicUrl, fileName, imageFile.size, user.id)

      if (onImageGenerated) {
        onImageGenerated(publicUrl)
      }

      toast.success('Doodle ready!')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export doodle')
    }
  }

  return (
    <Card className="border-2 border-foreground p-2 md:p-4" ref={containerRef}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-mono font-bold text-sm md:text-lg flex items-center gap-2 flex-shrink-0">
            <Paintbrush className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">DOODLE MINING</span>
            <span className="sm:hidden">DOODLE</span>
          </h3>
          <div className="flex gap-1 md:gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={undo}
              disabled={historyStep <= 0}
              className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3 h-3" />
            </Button>
            {isMobile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowToolbar(!showToolbar)}
                className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
                title={showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
              >
                {showToolbar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground font-mono leading-tight">
          Draw, upload, enhance with AI, then export
        </p>
      </div>

      {/* Toolbar */}
      {showToolbar && (
      <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-3 p-2 md:p-3 border-2 border-foreground bg-background">
        {/* Tool selection */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            className="font-mono text-xs p-1 h-7"
            title="Brush (B)"
          >
            <Paintbrush className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Brush</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            className="font-mono text-xs p-1 h-7"
            title="Eraser (E)"
          >
            <Eraser className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Erase</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'stamp' ? 'default' : 'outline'}
            onClick={() => setTool('stamp')}
            className="font-mono text-xs p-1 h-7"
            title="Stamp (S)"
          >
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Stamp</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'bucket' ? 'default' : 'outline'}
            onClick={() => setTool('bucket')}
            className="font-mono text-xs p-1 h-7"
            title="Fill (F/G)"
          >
            <PaintBucket className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Fill</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'mask' ? 'default' : 'outline'}
            onClick={() => setTool('mask')}
            className="font-mono text-xs p-1 h-7"
            title="Mask Tool (M)"
          >
            <Square className="w-3 h-3 text-red-500" />
            <span className="hidden sm:inline ml-1 text-[10px]">Mask</span>
          </Button>
        </div>

        {/* Brush style for normal brush */}
        {tool === 'brush' && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={brushStyle === 'normal' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('normal')}
              className="font-mono text-[10px] p-1 h-7"
              title="Normal"
            >
              Normal
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'spray' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('spray')}
              className="font-mono text-[10px] p-1 h-7"
              title="Spray"
            >
              Spray
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'calligraphy' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('calligraphy')}
              className="font-mono text-[10px] p-1 h-7"
              title="Calligraphy"
            >
              Calli
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'marker' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('marker')}
              className="font-mono text-[10px] p-1 h-7"
              title="Marker"
            >
              Marker
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'pencil' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('pencil')}
              className="font-mono text-[10px] p-1 h-7"
              title="Pencil"
            >
              Pencil
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'airbrush' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('airbrush')}
              className="font-mono text-[10px] p-1 h-7"
              title="Airbrush"
            >
              Airbrush
            </Button>
          </div>
        )}

        {/* Stamp type selection */}
        {tool === 'stamp' && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={stampType === 'circle' ? 'default' : 'outline'}
              onClick={() => setStampType('circle')}
              className="font-mono text-xs p-1 h-7"
              title="Circle"
            >
              <Circle className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'square' ? 'default' : 'outline'}
              onClick={() => setStampType('square')}
              className="font-mono text-xs p-1 h-7"
              title="Square"
            >
              <Square className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'star' ? 'default' : 'outline'}
              onClick={() => setStampType('star')}
              className="font-mono text-xs p-1 h-7"
              title="Star"
            >
              <Star className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Texture selection */}
        {tool === 'brush' && (
          <div className="flex gap-1 overflow-x-auto max-w-[200px] no-scrollbar">
            <Button
              size="sm"
              variant={selectedTexture === null ? 'default' : 'outline'}
              onClick={() => setSelectedTexture(null)}
              className="font-mono text-[10px] p-1 h-7 shrink-0"
              title="No Texture"
            >
              Solid
            </Button>
            {TEXTURE_PRESETS.map(texture => (
              <Button
                key={texture.id}
                size="sm"
                variant={selectedTexture === texture.id ? 'default' : 'outline'}
                onClick={() => setSelectedTexture(texture.id)}
                className="font-mono text-[10px] p-1 h-7 shrink-0 flex items-center gap-1"
                title={texture.name}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:inline">{texture.name}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Color Palette selection */}
        {tool === 'brush' && !selectedTexture && (
          <div className="flex gap-1 overflow-x-auto max-w-[200px] no-scrollbar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-mono text-[10px] p-1 h-7 shrink-0">
                  <Palette className="w-3 h-3 mr-1" />
                  {activePalette.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px] font-mono">
                {COLOR_PALETTES.map(palette => (
                  <DropdownMenuItem key={palette.name} onClick={() => setActivePalette(palette)}>
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex justify-between items-center">
                        <span>{palette.name}</span>
                        {activePalette.name === palette.name && <Sparkles className="w-3 h-3" />}
                      </div>
                      <div className="flex gap-1">
                        {palette.colors.slice(0, 8).map(c => (
                          <div key={c} className="w-3 h-3 border border-foreground" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex gap-1">
              {activePalette.colors.map(color => (
                <button
                  key={color}
                  className={cn(
                    "w-6 h-6 border-2 border-foreground hover:scale-110 transition-transform",
                    brushColor === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setBrushColor(color)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mask Overlay Toggle */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={showMask ? 'default' : 'outline'}
            onClick={() => setShowMask(!showMask)}
            className="font-mono text-[10px] p-1 h-7"
            title="Toggle Mask Overlay"
          >
            {showMask ? 'Mask On' : 'Mask Off'}
          </Button>
        </div>

        {/* Image upload */}
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Load image as background"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Img</span>
          </Button>
        </div>

        {/* Color picker - Mobile optimized */}
        {tool === 'brush' && !selectedTexture && (
          <div className="flex items-center gap-1 md:gap-2">
            <Label className="text-[10px] md:text-xs font-mono hidden sm:inline">Color:</Label>
            <div className="flex gap-1 items-center">
              <Input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-7 h-7 md:w-10 md:h-8 p-0.5 md:p-1 cursor-pointer"
                title="Pick color"
              />
              <Input
                type="text"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-14 md:w-20 h-7 md:h-8 font-mono text-[10px] md:text-xs"
              />
            </div>
          </div>
        )}

        {/* Brush size - Mobile optimized */}
        <div className="flex items-center gap-1 md:gap-2">
          <Label className="text-[10px] md:text-xs font-mono hidden sm:inline">Size:</Label>
          <Slider
            value={[brushSize]}
            onValueChange={(v) => setBrushSize(v[0])}
            min={1}
            max={50}
            step={1}
            className="w-16 md:w-24"
          />
          <span className="text-[10px] md:text-xs font-mono w-5 text-center">{brushSize}</span>
        </div>

        {/* Tolerance for bucket */}
        {tool === 'bucket' && (
          <div className="flex items-center gap-1 md:gap-2">
            <Label className="text-[10px] md:text-xs font-mono hidden sm:inline">Fill Tol:</Label>
            <Slider
              value={[tolerance]}
              onValueChange={(v) => setTolerance(v[0])}
              min={0}
              max={255}
              step={1}
              className="w-16 md:w-24"
            />
            <span className="text-[10px] md:text-xs font-mono w-5 text-center">{tolerance}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 md:gap-2 md:ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={applyDitheringEffect}
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Apply dithering effect"
          >
            <Wand2 className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Dither</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearCanvas}
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Clear canvas"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Clear</span>
          </Button>
        </div>
      </div>
      )}

      {/* Canvas - Mobile optimized */}
      <div className="mb-4 border-2 border-foreground bg-card overflow-x-auto relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={onMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={onMove}
          onTouchEnd={stopDrawing}
          className="w-full h-auto cursor-crosshair touch-none block z-10"
          style={{ touchAction: 'none', maxWidth: '100%', display: 'block' }}
        />
        <canvas
          ref={maskCanvasRef}
          className={`absolute inset-0 w-full h-auto pointer-events-none z-20 opacity-40 ${showMask ? 'block' : 'hidden'}`}
          style={{ maxWidth: '100%' }}
        />
      </div>

      {/* AI Enhancement Panel */}
      <div className="space-y-2 md:space-y-3">
        <Button
          variant="outline"
          className="w-full font-mono text-xs md:text-sm p-2 md:p-3"
          onClick={() => setShowAiPanel(!showAiPanel)}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {showAiPanel ? 'Hide AI' : 'Enhance with AI'}
        </Button>

        {showAiPanel && (
          <div className="border-2 border-foreground p-2 md:p-3 space-y-2 md:space-y-3">
            <div>
              <Label className="font-mono text-[10px] md:text-xs mb-1 md:mb-2 block">
                AI PROMPT
              </Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Make it colorful, add shading..."
                className="font-mono text-xs p-1.5 md:p-2"
                disabled={generating}
              />
              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono mt-1">
                Describe the enhancement. Iterative refinement supported!
              </p>
            </div>
            <Button
              className="w-full font-mono text-xs md:text-sm p-2 md:p-3"
              onClick={generateWithAI}
              disabled={generating || !aiPrompt.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generating ? 'GENERATING...' : 'ENHANCE'}
            </Button>
            <p className="text-[9px] md:text-[10px] text-center text-muted-foreground font-mono">
              💡 Click multiple times to refine
            </p>
          </div>
        )}

        {/* Export Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 font-mono text-xs md:text-sm p-1.5 md:p-2"
            onClick={downloadCanvas}
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Download</span>
          </Button>
          {onImageGenerated && (
            <Button
              className="flex-1 font-mono text-xs md:text-sm p-1.5 md:p-2"
              onClick={exportToThread}
            >
              <ImageIcon className="w-3 h-3" />
              <span className="hidden sm:inline ml-1">Use in Thread</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
