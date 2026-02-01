import { useState, useEffect, useRef } from 'react'
import { Send, Zap, MessageSquare } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { processRichText } from '../../lib/rich-text'
import { useAuth } from '../../contexts/AuthContext'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { getPoWValidationData } from '../../lib/pow-validation'
import { invokeFunction } from '../../lib/functions-utils'
import toast from 'react-hot-toast'
import { BadgesInline } from '../../lib/badge-utils'

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
    <div className="border-2 border-primary bg-background shadow-3d-sm font-sans overflow-hidden">
      {/* Header */}
      <div className="border-b-2 border-primary bg-primary text-background px-3 py-1 font-black text-[10px] uppercase tracking-widest flex justify-between items-center">
        <span className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3" />
          Global Chat
        </span>
        <div className="flex items-center gap-2">
          <Zap size={10} className={hasValidPoW ? 'text-background animate-pulse' : 'text-background/40'} />
          <span className="text-[9px] font-black">
            {hasValidPoW ? 'READY' : 'MINING...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[250px] overflow-y-auto p-3 space-y-1.5 font-sans text-xs custom-scrollbar bg-primary/5">
        {messages.map((msg) => (
          <div key={msg.id} className="leading-relaxed border-b border-primary/5 pb-1">
            <span className="text-muted-foreground opacity-60 font-bold text-[9px] tabular-nums">{formatTime(msg.timestamp)}</span>{' '}
            <span className="font-black text-primary uppercase tracking-tighter inline-flex items-center gap-1">
              {msg.username}
              <BadgesInline user={msg.user} className="scale-75" />
            </span>
            {': '}
            <div className="inline-block text-foreground/90 font-medium">{processRichText(msg.content)}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t-2 border-primary/20 p-2 flex flex-col gap-2 bg-background">
        {dedicatedSession && !hasValidPoW && (
          <div className="w-full bg-primary/10 h-1 overflow-hidden border border-primary/10">
            <div className="h-full bg-primary animate-progress-fast" />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={hasValidPoW ? "Type message..." : "Waiting for PoW..."}
            className="flex-1 h-8 border-2 border-primary/20 bg-primary/5 text-foreground font-sans text-[11px] focus:border-primary transition-colors font-medium"
            disabled={!hasValidPoW}
          />
          <Button
            onClick={sendMessage}
            className={`h-8 px-3 border-2 border-primary font-black uppercase text-[10px] tracking-widest shadow-sm ${hasValidPoW ? 'bg-primary text-background' : 'opacity-30'}`}
            size="sm"
            disabled={!hasValidPoW}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
