import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { usePoWValidity } from '../hooks/use-pow-validity'
import { useMining } from '../hooks/use-mining'
import { MiningManager } from '../lib/mining/MiningManager'
import { getPoWValidationData } from '../lib/pow-validation'
import { invokeFunction } from '../lib/functions-utils'
import { Zap } from 'lucide-react'

export function CreateChatRoomPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxUsers, setMaxUsers] = useState(256)
  const [creating, setCreating] = useState(false)
  
  const ROOM_DIFFICULTY = { prefix: '21e8', points: 15 }
  const hasValidPoW = usePoWValidity(ROOM_DIFFICULTY.prefix, ROOM_DIFFICULTY.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())

  useEffect(() => {
    // Start background mining for chat room creation
    console.log('[CreateChatRoomPage] Starting dedicated mining for chat room creation...')
    miningManagerRef.current.startDedicatedMining('chat-room', undefined, ROOM_DIFFICULTY.points, ROOM_DIFFICULTY.prefix)
      .catch(err => console.error('[CreateChatRoomPage] Mining error:', err))
      
    return () => {
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !description) {
      toast.error('Name and description are required')
      return
    }

    if (!hasValidPoW) {
      toast.error(`Mining in progress... Please wait for valid PoW (hash starting with ${ROOM_DIFFICULTY.prefix}).`)
      return
    }

    if (maxUsers < 2 || maxUsers > 1000) {
      toast.error('Max users must be between 2 and 1000')
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

      // Get current user from auth state
      if (!authState.user) {
        toast.error('You must be logged in to create a chat room')
        navigate('/auth')
        return
      }

      // Create chat room (all user-created rooms are public)
      const room = await db.db.chatRooms.create({
        id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: authState.user.id,
        name,
        description,
        isPublic: 1,
        maxUsers,
      })

      // 2. Submit PoW to link it properly
      await invokeFunction('validate-pow', {
        body: {
          ...powData,
          targetType: 'global', // Or 'chat-room' if supported, but 'global' is safe
          targetId: room.id,
          userId: authState.user.id
        }
      })

      // Clear PoW after use
      miningManagerRef.current.clearLastPoWResult()

      toast.success('Chat room created successfully!')
      navigate(`/chat/rooms`)
    } catch (error: any) {
      console.error('Failed to create chat room:', error)
      toast.error(error.message || 'Failed to create chat room')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="border-2 border-primary bg-card">
          <div className="bg-primary text-primary-foreground p-4 font-mono font-bold text-xl flex justify-between items-center">
            <span>CREATE NEW CHAT ROOM</span>
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
                    ? `🔨 FORGING ROOM - Searching for hash starting with ${ROOM_DIFFICULTY.prefix} (${ROOM_DIFFICULTY.points}+ points).`
                    : '⚠ FORGE STOPPED - Please refresh or restart.'}
              </span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Room Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., General Discussion"
                maxLength={100}
                className="font-mono border-primary bg-background text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                The display name of your chat room (max 100 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this room is for..."
                maxLength={200}
                rows={4}
                className="font-mono border-primary bg-background text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Brief description of the room's purpose (max 200 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2 text-primary">
                Max Users
              </label>
              <Input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                min={2}
                max={1000}
                className="font-mono border-primary bg-background text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of users allowed in this room (2-1000)
              </p>
            </div>

            <div className="border border-primary p-4 bg-muted">
              <p className="text-sm font-mono text-muted-foreground">
                <strong>Note:</strong> All user-created chat rooms are public and visible to everyone.
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
                {creating ? 'CREATING...' : !hasValidPoW ? 'WAITING FOR POW' : 'CREATE ROOM'}
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
