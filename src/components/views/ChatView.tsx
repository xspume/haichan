import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { BadgesInline } from '../../lib/badge-utils'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { getPoWValidationData } from '../../lib/pow-validation'
import { invokeFunction } from '../../lib/functions-utils'
import { Zap } from 'lucide-react'

interface Message {
  id: string
  userId: string
  username: string
  content: string
  timestamp: number
  user?: any
}

export function ChatView() {
  const { authState } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const CHAT_DIFFICULTY = { prefix: '21e8', points: 15 }
  const hasValidPoW = usePoWValidity(CHAT_DIFFICULTY.prefix, CHAT_DIFFICULTY.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())

  useEffect(() => {
    // Load initial messages - simulate chat with timestamps
    const sampleMessages: Message[] = [
      { id: '1', userId: 'sys', username: 'SYSTEM', content: 'Welcome to Haichan global chat', timestamp: Date.now() - 300000 },
      { id: '2', userId: 'anon1', username: 'Anonymous', content: 'mining in progress...', timestamp: Date.now() - 120000 },
      { id: '3', userId: 'anon2', username: 'Anonymous', content: 'found 21e8 hash!', timestamp: Date.now() - 60000 }
    ]
    setMessages(sampleMessages)
    
    // Start background mining for chat
    miningManagerRef.current.startDedicatedMining('global', 'global', CHAT_DIFFICULTY.points, CHAT_DIFFICULTY.prefix)
      .catch(err => console.error('[ChatView] Mining error:', err))
      
    return () => {
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim() || !authState.user) return
    
    if (!hasValidPoW) {
      toast.error('Mining PoW... Please wait.')
      return
    }

    try {
      const powData = getPoWValidationData()
      if (powData) {
        invokeFunction('validate-pow', {
          body: {
            ...powData,
            targetType: 'global',
            targetId: 'global',
            userId: authState.user.id
          }
        }).catch(err => console.error('Failed to validate PoW for chat:', err))
        
        miningManagerRef.current.clearLastPoWResult()
        miningManagerRef.current.startDedicatedMining('global', 'global', CHAT_DIFFICULTY.points, CHAT_DIFFICULTY.prefix)
      }

      const msg: Message = {
        id: Date.now().toString(),
        userId: authState.user.id,
        username: authState.user.username || 'Anonymous',
        content: newMessage,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, msg])
      setNewMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="border-2 border-black bg-background">
      {/* Header */}
      <div className="border-b-2 border-black bg-black text-white px-3 py-1 font-mono text-sm font-bold flex justify-between items-center">
        <span>Global Chat</span>
        <div className="flex items-center gap-2">
          <Zap size={12} className={hasValidPoW ? 'text-green-400' : 'animate-pulse text-gray-400'} />
          <span className="text-[10px] uppercase font-normal">
            {hasValidPoW ? 'Ready' : 'Processing...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[300px] overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {messages.map((msg) => (
          <div key={msg.id} className="leading-tight">
            <span className="text-gray-600">{formatTime(msg.timestamp)}</span>{' '}
            <span className="font-bold flex items-center gap-0.5">
              {msg.username}
              <BadgesInline user={msg.user} className="inline-flex ml-0.5" />
            </span>
            {': '}
            <span>{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t-2 border-black p-2 flex flex-col gap-2">
        {dedicatedSession && !hasValidPoW && (
          <div className="w-full bg-gray-200 h-0.5 overflow-hidden">
            <div className="h-full bg-black animate-progress-fast" />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={hasValidPoW ? "Type message..." : "Waiting for PoW..."}
            className="flex-1 h-8 border-2 border-black font-mono text-xs"
            disabled={!hasValidPoW}
          />
          <Button
            onClick={sendMessage}
            className={`h-8 px-3 border-2 border-black font-mono ${hasValidPoW ? 'bg-black text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            size="sm"
            disabled={!hasValidPoW}
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}