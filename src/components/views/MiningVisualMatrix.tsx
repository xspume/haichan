import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import { cn } from '../../lib/utils'
import { DEFAULT_VISUAL_MATRIX, type VisualMatrix } from '../../lib/visual-matrix'
import { useAiTexture } from '../../hooks/use-ai-texture'
import { Sparkles, RefreshCw, Wand2 } from 'lucide-react'

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function timeOfDayT(nowMs: number) {
  // 90s arcade day/night loop: 0..1 over 90 seconds
  return (nowMs % 90_000) / 90_000
}

function todFactor(matrix: VisualMatrix, nowMs: number) {
  if (matrix.timeOfDay === 'auto') return timeOfDayT(nowMs)
  const map: Record<Exclude<VisualMatrix['timeOfDay'], 'auto'>, number> = {
    dawn: 0.18,
    day: 0.35,
    dusk: 0.62,
    night: 0.85
  }
  return map[matrix.timeOfDay]
}

function paletteColors(matrix: VisualMatrix) {
  switch (matrix.palette) {
    case 'phosphor':
      return { bg: 'hsl(var(--background))', a: 'hsl(var(--primary))', b: 'hsl(var(--accent))' }
    case 'amber':
      return { bg: 'hsl(var(--background))', a: 'hsl(var(--primary))', b: 'hsl(var(--muted-foreground))' }
    case 'ink':
      return { bg: 'hsl(var(--background))', a: 'hsl(var(--foreground))', b: 'hsl(var(--muted))' }
    case 'paper':
    default:
      return { bg: 'hsl(var(--background))', a: 'hsl(var(--foreground))', b: 'hsl(var(--primary))' }
  }
}

interface MiningVisualMatrixProps {
  hash?: string
}

export function MiningVisualMatrix({ hash }: MiningVisualMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureImgRef = useRef<HTMLImageElement | null>(null)

  const [matrix, setMatrix] = useState<VisualMatrix>(DEFAULT_VISUAL_MATRIX)
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState({ w: 960, h: 480 })

  const ai = useAiTexture()

  const colors = useMemo(() => paletteColors(matrix), [matrix])

  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const w = Math.max(320, Math.min(1100, el.clientWidth))
      const h = Math.round(w * 0.5)
      setSize({ w, h })
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const noise = document.createElement('canvas')
    noise.width = 256
    noise.height = 256
    noiseCanvasRef.current = noise

    const scan = document.createElement('canvas')
    scan.width = 512
    scan.height = 512
    scanCanvasRef.current = scan

    const scanCtx = scan.getContext('2d')
    if (scanCtx) {
      scanCtx.clearRect(0, 0, scan.width, scan.height)
      scanCtx.globalAlpha = 0.7
      scanCtx.strokeStyle = 'rgba(0,0,0,0.12)'
      scanCtx.lineWidth = 1
      for (let y = 0; y < scan.height; y += 3) {
        scanCtx.beginPath()
        scanCtx.moveTo(0, y)
        scanCtx.lineTo(scan.width, y)
        scanCtx.stroke()
      }
    }
  }, [])

  useEffect(() => {
    // Update texture image object when url changes
    if (!ai.url) {
      textureImgRef.current = null
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      textureImgRef.current = img
    }
    img.src = ai.url
  }, [ai.url])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = size.w
    canvas.height = size.h

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawNoise = (seed: number) => {
      const n = noiseCanvasRef.current
      if (!n) return
      const nctx = n.getContext('2d')
      if (!nctx) return
      const img = nctx.createImageData(n.width, n.height)
      const d = img.data
      // cheap RNG
      let x = (seed | 0) ^ 0x9e3779b9
      for (let i = 0; i < d.length; i += 4) {
        x ^= x << 13
        x ^= x >>> 17
        x ^= x << 5
        const v = x & 255
        d[i] = v
        d[i + 1] = v
        d[i + 2] = v
        d[i + 3] = 255
      }
      nctx.putImageData(img, 0, 0)
    }

    const render = (ts: number) => {
      // cap to 24fps
      if (ts - lastFrameRef.current < 41.6) {
        rafRef.current = requestAnimationFrame(render)
        return
      }
      lastFrameRef.current = ts

      const t = todFactor(matrix, Date.now())
      const day = Math.sin(t * Math.PI * 2) * 0.5 + 0.5
      const nightOverlay = clamp01(lerp(0.62, 0.08, day))

      // base field
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // persistence effect (simulated CRT phosphor lag)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // soft light volume
      const g = ctx.createRadialGradient(
        canvas.width * (0.2 + 0.6 * day),
        canvas.height * 0.35,
        canvas.width * 0.1,
        canvas.width * 0.5,
        canvas.height * 0.55,
        canvas.width * 0.85
      )
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(0,0,0,${nightOverlay})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // texture (tiled)
      const tex = textureImgRef.current
      if (tex && matrix.textureIntensity > 0.01) {
        try {
          const pat = ctx.createPattern(tex, 'repeat')
          if (pat) {
            ctx.save()
            ctx.globalAlpha = clamp01(matrix.textureIntensity)
            ctx.globalCompositeOperation = matrix.bloom ? 'screen' : 'multiply'
            ctx.fillStyle = pat
            ctx.translate((ts * 0.01) % tex.width, (ts * 0.006) % tex.height)
            ctx.fillRect(-tex.width, -tex.height, canvas.width + tex.width * 2, canvas.height + tex.height * 2)
            ctx.restore()
          }
        } catch {
          // ignore pattern failures
        }
      }

      // lighting accents / fuzzy oscilloscope
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      
      if (hash) {
        // Fuzzy oscilloscope rendering based on hash
        // We'll create a "diamond" central focus by narrowing the wave in the middle
        const hashBits = hash.split('').map(hex => parseInt(hex, 16).toString(2).padStart(4, '0')).join('')
        const layers = 6
        
        ctx.shadowBlur = 8
        ctx.shadowColor = colors.a
        
        for (let j = 0; j < layers; j++) {
          ctx.beginPath()
          ctx.strokeStyle = colors.a
          ctx.globalAlpha = 0.15 + (Math.random() * 0.2)
          ctx.lineWidth = 0.5 + Math.random() * 2.0
          
          const stepX = canvas.width / 256 // higher resolution for fuzz
          const centerY = canvas.height / 2
          
          for (let x = 0; x <= 256; x++) {
            const bitIndex = (x + Math.floor(ts * 0.03)) % hashBits.length
            const bitValue = parseInt(hashBits[bitIndex])
            
            // Envelope for diamond shape - wider in middle
            const xNorm = (x / 256) * 2 - 1 // -1 to 1
            const envelope = 1 - Math.abs(xNorm)
            
            const bitOffset = (bitValue * 80 - 40) * envelope * (0.8 + 0.2 * Math.sin(ts * 0.002 + j))
            const fuzzyNoise = (Math.random() - 0.5) * 12
            const highFreqNoise = Math.sin(x * 0.5 + ts * 0.1) * 3
            
            const targetY = centerY + bitOffset + fuzzyNoise + highFreqNoise
            
            if (x === 0) {
              ctx.moveTo(0, targetY)
            } else {
              ctx.lineTo(x * stepX, targetY)
            }
          }
          ctx.stroke()
        }
        
        // Central pulse
        ctx.beginPath()
        ctx.strokeStyle = '#fff'
        ctx.globalAlpha = 0.1
        ctx.lineWidth = 1
        ctx.moveTo(0, canvas.height/2)
        ctx.lineTo(canvas.width, canvas.height/2)
        ctx.stroke()
        
        ctx.shadowBlur = 0
      } else {
        // Default idle oscilloscope
        const waves = 4
        for (let i = 0; i < waves; i++) {
          ctx.beginPath()
          ctx.strokeStyle = colors.a
          ctx.globalAlpha = 0.2
          const centerY = (canvas.height * (i + 1)) / (waves + 1)
          for (let x = 0; x <= canvas.width; x += 12) {
            const wobble = Math.sin((x * 0.03) + (ts * 0.002) + i) * (15 + (Math.random() * 10))
            ctx.lineTo(x, centerY + wobble)
          }
          ctx.stroke()
        }
      }
      ctx.restore()

      // scanlines
      if (matrix.scanlines) {
        const scan = scanCanvasRef.current
        if (scan) {
          ctx.save()
          ctx.globalAlpha = 0.35
          ctx.globalCompositeOperation = 'overlay'
          ctx.drawImage(scan, 0, (ts * 0.06) % 6 - 6, canvas.width, canvas.height + 12)
          ctx.restore()
        }
      }

      // grain
      if (matrix.grain !== 'none' && matrix.grainIntensity > 0.01) {
        drawNoise((ts * 0.5) | 0)
        const n = noiseCanvasRef.current
        if (n) {
          ctx.save()
          ctx.globalAlpha = clamp01(matrix.grainIntensity)
          ctx.globalCompositeOperation = matrix.grain === 'crt' ? 'overlay' : 'soft-light'
          ctx.drawImage(n, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }
      }

      // vignette
      if (matrix.vignette) {
        const v = ctx.createRadialGradient(
          canvas.width * 0.5,
          canvas.height * 0.5,
          canvas.width * 0.1,
          canvas.width * 0.5,
          canvas.height * 0.5,
          canvas.width * 0.8
        )
        v.addColorStop(0, 'rgba(0,0,0,0)')
        v.addColorStop(1, 'rgba(0,0,0,0.45)')
        ctx.save()
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = v
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [matrix, size.w, size.h, colors])

  const generate = async () => {
    await ai.generate(matrix, prompt)
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="border-2 border-primary bg-background">
            <canvas ref={canvasRef} className="block w-full h-auto" />
          </div>
          <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
            <div className="text-[10px] uppercase tracking-[0.25em] opacity-60">
              {ai.url ? 'AI_TEXTURE: CACHED' : 'AI_TEXTURE: NONE'}
              {ai.isLoading ? ' • GENERATING…' : ''}
              {ai.error ? ' • ERROR' : ''}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => setMatrix(DEFAULT_VISUAL_MATRIX)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                className={cn('rounded-none', ai.isLoading && 'opacity-70 pointer-events-none')}
                onClick={generate}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Texture
              </Button>
            </div>
          </div>
          {ai.error && (
            <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-destructive">
              {ai.error}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-none border-2 border-primary/40 bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] opacity-60">Visual Matrix</div>
                <div className="text-sm font-black tracking-tight">ATTRIBUTES_GRID</div>
              </div>
              <Wand2 className="h-5 w-5 opacity-60" />
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest opacity-60">AI Theme</Label>
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="CRT ocean trench • rusted satellites • snow static…"
                  className="rounded-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Time</Label>
                  <Select value={matrix.timeOfDay} onValueChange={(v) => setMatrix(m => ({ ...m, timeOfDay: v as any }))}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="dawn">dawn</SelectItem>
                      <SelectItem value="day">day</SelectItem>
                      <SelectItem value="dusk">dusk</SelectItem>
                      <SelectItem value="night">night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Lighting</Label>
                  <Select value={matrix.lighting} onValueChange={(v) => setMatrix(m => ({ ...m, lighting: v as any }))}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="soft">soft</SelectItem>
                      <SelectItem value="hard">hard</SelectItem>
                      <SelectItem value="neon">neon</SelectItem>
                      <SelectItem value="moon">moon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Palette</Label>
                  <Select value={matrix.palette} onValueChange={(v) => setMatrix(m => ({ ...m, palette: v as any }))}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="paper">paper</SelectItem>
                      <SelectItem value="phosphor">phosphor</SelectItem>
                      <SelectItem value="amber">amber</SelectItem>
                      <SelectItem value="ink">ink</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Grain</Label>
                  <Select value={matrix.grain} onValueChange={(v) => setMatrix(m => ({ ...m, grain: v as any }))}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">none</SelectItem>
                      <SelectItem value="film">film</SelectItem>
                      <SelectItem value="crt">crt</SelectItem>
                      <SelectItem value="dust">dust</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-widest opacity-60">Texture</Label>
                    <span className="text-[10px] tabular-nums opacity-60">{Math.round(matrix.textureIntensity * 100)}%</span>
                  </div>
                  <Slider
                    value={[matrix.textureIntensity * 100]}
                    onValueChange={(v) => setMatrix(m => ({ ...m, textureIntensity: clamp01((v[0] ?? 0) / 100) }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-widest opacity-60">Grain</Label>
                    <span className="text-[10px] tabular-nums opacity-60">{Math.round(matrix.grainIntensity * 100)}%</span>
                  </div>
                  <Slider
                    value={[matrix.grainIntensity * 100]}
                    onValueChange={(v) => setMatrix(m => ({ ...m, grainIntensity: clamp01((v[0] ?? 0) / 100) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={matrix.scanlines} onCheckedChange={(c) => setMatrix(m => ({ ...m, scanlines: c }))} />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">scan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={matrix.vignette} onCheckedChange={(c) => setMatrix(m => ({ ...m, vignette: c }))} />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">vign</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={matrix.bloom} onCheckedChange={(c) => setMatrix(m => ({ ...m, bloom: c }))} />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">bloom</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
