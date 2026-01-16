import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { usePoWValidity } from '../hooks/use-pow-validity'
import { useMining } from '../hooks/use-mining'
import { MiningManager } from '../lib/mining/MiningManager'
import { getPoWValidationData } from '../lib/pow-validation'
import { invokeFunction } from '../lib/functions-utils'
import { Zap } from 'lucide-react'

export function CreateBoardPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  
  const BOARD_DIFFICULTY = { prefix: '21e80', points: 60 }
  const hasValidPoW = usePoWValidity(BOARD_DIFFICULTY.prefix, BOARD_DIFFICULTY.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())

  useEffect(() => {
    // Start background mining for board creation
    console.log('[CreateBoardPage] Starting dedicated mining for board creation...')
    miningManagerRef.current.startDedicatedMining('board', undefined, BOARD_DIFFICULTY.points, BOARD_DIFFICULTY.prefix)
      .catch(err => console.error('[CreateBoardPage] Mining error:', err))
      
    return () => {
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [])

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 10)
    setSlug(generatedSlug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !slug || !description) {
      toast.error('All fields are required')
      return
    }

    if (!hasValidPoW) {
      toast.error(`Mining in progress... Please wait for valid PoW (hash starting with ${BOARD_DIFFICULTY.prefix}). Board creation requires more energy.`)
      return
    }

    if (slug.length < 2 || slug.length > 10) {
      toast.error('Slug must be 2-10 characters')
      return
    }

    if (!/^[a-z0-9]+$/.test(slug)) {
      toast.error('Slug can only contain lowercase letters and numbers')
      return
    }

    setCreating(true)

    try {
      // 1. Get PoW data
      const powData = getPoWValidationData()
      if (!powData) {
        toast.error('PoW data missing. Please retry.')
        setCreating(false)
        return
      }

      // Check if slug already exists
      const existing = await db.db.boards.list({
        where: { slug }
      })

      if (existing.length > 0) {
        toast.error('Board with this slug already exists')
        setCreating(false)
        return
      }

      // Verify user is authenticated
      if (!authState.user?.id) {
        toast.error('You must be logged in to create a board')
        navigate('/auth')
        return
      }

      // Create board (all user-created boards are public)
      const newBoard = await db.db.boards.create({
        id: `board_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name,
        slug,
        description,
        totalPow: powData.points, // Initial PoW
        lastActivityAt: new Date().toISOString(),
        expired: 0,
        userId: authState.user.id
      })

      // 2. Submit PoW to link it properly
      await invokeFunction('validate-pow', {
        body: {
          ...powData,
          targetType: 'board',
          targetId: newBoard.id,
          userId: authState.user.id
        }
      })

      // Clear PoW after use
      miningManagerRef.current.clearLastPoWResult()

      toast.success('Board created successfully!')
      
      // Publish realtime event
      await db.realtime.publish('boards-updates', 'board-created', {
        slug,
        name
      })

      navigate(`/board/${slug}`)
    } catch (error: any) {
      console.error('Failed to create board:', error)
      toast.error(error.message || 'Failed to create board')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="border-2 border-primary bg-card">
          <div className="bg-primary text-primary-foreground p-4 font-mono font-bold text-xl flex justify-between items-center">
            <span>CREATE NEW BOARD</span>
            <div className="flex items-center gap-2">
              <Zap size={16} className={hasValidPoW ? 'text-green-400' : 'animate-pulse text-white'} />
              <span className="text-xs uppercase font-normal">
                {hasValidPoW ? 'PoW Ready' : 'Mining...'}
              </span>
            </div>
          </div>

          <div className={`mx-6 mt-6 p-3 border-2 border-dashed font-mono text-xs ${
            hasValidPoW 
              ? 'bg-green-900/20 border-green-500 text-green-400' 
              : dedicatedSession 
                ? 'bg-amber-600/20 border-amber-500 text-amber-100'
                : 'bg-red-900/20 border-red-500 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              <Zap size={12} className={hasValidPoW ? 'text-green-400' : 'animate-pulse'} />
              <span>
                {hasValidPoW 
                  ? '✓ MINING COMPLETE - Computational requirement met.' 
                  : dedicatedSession 
                    ? `🔨 FORGING HUB - Searching for hash starting with ${BOARD_DIFFICULTY.prefix} (${BOARD_DIFFICULTY.points}+ points).`
                    : '⚠ FORGE STOPPED - Please refresh or restart.'}
              </span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Board Name
              </label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Technology"
                maxLength={50}
                className="font-mono border-primary bg-background text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                The display name of your board (max 50 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Board Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="tech"
                  maxLength={10}
                  pattern="[a-z0-9]+"
                  className="font-mono border-primary bg-background text-foreground"
                  required
                />
                <span className="font-mono text-muted-foreground">/</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                URL-friendly identifier (2-10 chars, lowercase letters and numbers only)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this board is about..."
                maxLength={200}
                rows={4}
                className="font-mono border-primary bg-background text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Brief description of the board's topic (max 200 chars)
              </p>
            </div>

            <div className="border border-primary p-4 bg-muted">
              <p className="text-sm font-mono text-muted-foreground">
                <strong>Note:</strong> All user-created boards are public and visible to everyone.
                Boards with no activity for 7 days will automatically expire.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={creating || !hasValidPoW}
                className={`flex-1 font-mono font-bold transition-colors ${
                  !hasValidPoW 
                    ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed' 
                    : 'bg-primary text-primary-foreground hover:bg-background hover:text-primary border border-primary'
                }`}
              >
                {creating ? 'CREATING...' : !hasValidPoW ? 'WAITING FOR POW' : 'CREATE BOARD'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="font-mono font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                CANCEL
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
