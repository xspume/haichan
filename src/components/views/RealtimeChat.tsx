import { invokeFunction } from '../../lib/functions-utils'
import { useState, useEffect, useRef } from 'react'
import { Send, Users as UsersIcon, Bot, Plus, UserPlus, Zap } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import db from '../../lib/db-client'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formatBrandName } from '../../lib/utils'
import { requestCache } from '../../lib/request-cache'
import { useAuth } from '../../contexts/AuthContext'
import { playPingSound, playClickSound } from '../../lib/sound-utils'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { getPoWValidationData } from '../../lib/pow-validation'

// Extracted ChatInput component to prevent re-renders of the main list
const ChatInput = ({ onSend, disabled, hasValidPoW, dedicatedSession, difficulty }: { 
  onSend: (msg: string) => void, 
  disabled: boolean,
  hasValidPoW: boolean,
  dedicatedSession: boolean,
  difficulty: { prefix: string, points: number }
}) => {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim()) {
      if (!hasValidPoW) {
        toast.error('Mining in progress... Please wait for valid PoW.')
        return
      }
      onSend(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t-2 border-foreground p-2 flex flex-col gap-2">
      {/* PoW Progress Bar */}
      <div className={`px-2 py-1 border text-[9px] font-mono flex items-center justify-between ${
        hasValidPoW ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-primary/5 border-foreground/20 text-foreground/60'
      }`}>
        <div className="flex items-center gap-1.5">
          <Zap size={10} className={hasValidPoW ? 'text-green-400' : 'animate-pulse'} />
          <span>{hasValidPoW ? '✓ PoW READY' : dedicatedSession ? `MINING (${difficulty.prefix})...` : 'MINING STOPPED'}</span>
        </div>
        {!hasValidPoW && dedicatedSession && <div className="w-16 h-1 bg-foreground/10 overflow-hidden"><div className="h-full bg-primary animate-progress-fast" /></div>}
      </div>

      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasValidPoW ? "Type message..." : "Waiting for PoW..."}
          className="flex-1 px-2 py-1 border border-foreground bg-background text-foreground font-mono text-xs focus:outline-none"
          autoComplete="off"
          disabled={disabled || !hasValidPoW}
        />
        <Button 
          onClick={handleSend} 
          size="sm" 
          className={`font-mono flex-shrink-0 ${hasValidPoW ? 'bg-primary' : 'opacity-50'}`} 
          disabled={disabled || !hasValidPoW}
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

interface ChatMessage {
  id: string
  content: string
  userId: string
  username: string
  isBot: number
  createdAt: string
}

interface OnlineUser {
  userId: string
  username: string
  lastActivity: string
}

const INACTIVITY_TIMEOUT = 60 * 60 * 1000;
const REALTIME_CHANNEL = 'global-chat';
const ACTIVITY_CHANNEL = 'chat-activity';
const ACTIVITY_HEARTBEAT_INTERVAL = 60000;
const TALKY_CHECK_INTERVAL = 60000;
const MAX_USERS = 256;
const INITIAL_LOAD_LIMIT = 50;
const CACHE_TTL = 15000;
const MESSAGE_REFRESH_INTERVAL = 60000;

export function RealtimeChat() {
  const { authState, dbUser } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const user = dbUser || authState.user
  const [showCommandHelp, setShowCommandHelp] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [displayAsAnonymous, setDisplayAsAnonymous] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  
  const CHAT_DIFFICULTY = { prefix: '21e8', points: 15 }
  const hasValidPoW = usePoWValidity(CHAT_DIFFICULTY.prefix, CHAT_DIFFICULTY.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const navigate = useNavigate()

  useEffect(() => {
    const anonPref = localStorage.getItem('chat-anonymous')
    if (anonPref === 'true') setDisplayAsAnonymous(true)
  }, [])

  useEffect(() => {
    initializeMemory()
    initializeChatStats()
  }, [])

  const initializeMemory = async () => {
    try {
      const memories = await db.db.chatMemory.list({ limit: 1 })
      if (memories && memories.length === 0) {
        await db.db.chatMemory.create({
          id: `init-${Date.now()}`,
          memoryType: 'system',
          content: 'Talky AI mediator initialized. Mention @talky in your messages for mediation.',
          relevanceScore: 0.9,
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString()
        })
      }
    } catch (error) {}
  }

  const initializeChatStats = async () => {
    try {
      const stats = await db.db.chatStats.list({ limit: 1 })
      if (!stats || stats.length === 0) {
        await db.db.chatStats.create({
          id: 'singleton',
          totalUsers: 0,
          lastMessageAt: new Date().toISOString()
        })
      }
    } catch (error) {}
  }

  useEffect(() => {
    if (!user?.id) return

    loadMessages()
    loadOnlineUsers()
    updateActivity()

    // Start background mining for chat
    console.log('[RealtimeChat] Starting dedicated mining for chat messages...')
    miningManagerRef.current.startDedicatedMining('global', 'global', CHAT_DIFFICULTY.points, CHAT_DIFFICULTY.prefix)
      .catch(err => console.error('[RealtimeChat] Mining error:', err))

    const unsubscribeChat = db.realtime.subscribe(REALTIME_CHANNEL, (message: any) => {
      if (message.type === 'message') {
        setMessages(prev => {
          if (prev.some(m => m.id === message.data.id)) return prev
          
          // Play sound if mentioned or if it's a new message and we want sound
          const isMentioned = message.data.content.includes(`@${user?.username}`) || message.data.content.includes('@talky')
          if (isMentioned && message.data.userId !== user?.id) {
            playPingSound()
          }
          
          return [...prev, message.data]
        })
      }
    })

    const unsubscribeActivity = db.realtime.subscribe(ACTIVITY_CHANNEL, (message: any) => {
      if (message.type === 'activity-update') loadOnlineUsers()
    })

    const activityHeartbeat = setInterval(updateActivity, ACTIVITY_HEARTBEAT_INTERVAL)
    const inactivityCheck = setInterval(checkInactivity, 60000)
    const talkyInterval = setInterval(checkTalky, TALKY_CHECK_INTERVAL)
    const messageRefreshInterval = setInterval(() => loadMessages(100), MESSAGE_REFRESH_INTERVAL)

    const handleInteraction = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('mousemove', handleInteraction, { passive: true })
    window.addEventListener('keydown', handleInteraction, { passive: true })
    window.addEventListener('click', handleInteraction, { passive: true })

    return () => {
      unsubscribeChat?.then(unsub => unmountUnsubscribe(unsub));
      unsubscribeActivity?.then(unsub => unmountUnsubscribe(unsub));
      clearInterval(activityHeartbeat)
      clearInterval(inactivityCheck)
      clearInterval(talkyInterval)
      clearInterval(messageRefreshInterval)
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('click', handleInteraction)
      removeActivity()
      
      // Stop mining on unmount
      miningManagerRef.current.stopDedicatedMining()
    }
  }, [user?.id])

  const unmountUnsubscribe = (unsub: any) => {
    if (typeof unsub === 'function') unsub();
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async (limit: number = INITIAL_LOAD_LIMIT) => {
    try {
      const msgs = await requestCache.getOrFetch<ChatMessage[]>(
        `chat-messages-${limit}`,
        () => db.db.chatMessages.list({ where: { userId: user!.id }, orderBy: { createdAt: 'desc' }, limit }),
        CACHE_TTL
      )
      const sortedMessages = [...msgs].reverse()
      setMessages(sortedMessages)
    } catch (error) {}
  }

  const loadOnlineUsers = async () => {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const active = await requestCache.getOrFetch<OnlineUser[]>(
        'chat-online-users',
        () => db.db.chatActivity.list({ where: { userId: user!.id, lastActivity: { '>': twoMinutesAgo } } }),
        CACHE_TTL
      )
      setOnlineUsers(active)
    } catch (error) {}
  }

  const updateActivity = async () => {
    if (!user) return
    try {
      const username = formatBrandName(user.username || user.displayName || 'Anonymous')
      const existing = await db.db.chatActivity.list({ where: { userId: user.id }, limit: 1 })
      if (existing && existing.length > 0) {
        await db.db.chatActivity.update(existing[0].id, { lastActivity: new Date().toISOString() })
      } else {
        await db.db.chatActivity.create({
          id: `activity-${user.id}`,
          userId: user.id,
          username,
          lastActivity: new Date().toISOString()
        })
      }
      db.realtime.publish(ACTIVITY_CHANNEL, 'activity-update', { userId: user.id, username, timestamp: Date.now() })
    } catch (error) {}
  }

  const removeActivity = async () => {
    if (!user) return
    try {
      const existing = await db.db.chatActivity.list({ where: { userId: user.id }, limit: 1 })
      if (existing && existing.length > 0) await db.db.chatActivity.delete(existing[0].id)
    } catch (error) {}
  }

  const checkInactivity = () => {
    if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT) {
      toast.error('Redirecting due to inactivity...')
      navigate('/')
    }
  }

  const checkTalky = async () => {
    try {
      const { data, error } = await invokeFunction('talky-bot', { body: { action: 'check-and-speak' } });
      if (error || !data) return;
      if (data.spoke) loadMessages();
    } catch (error) {}
  }

  const invokeTalky = async (context: string) => {
    if (!user) return;
    try {
      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous');
      const { data, error } = await invokeFunction('talky-bot', { 
        body: { action: 'invoke', context, userId: user.id, username: actualUsername } 
      });
      if (data?.spoke && data?.message) {
        toast.success('Talky responded!');
        loadMessages();
      }
    } catch (error) {}
  }

  const checkForTickers = async (message: string) => {
    try {
      const tickerPattern = /\$\(([A-Za-z0-9]+)\)|\$([A-Za-z0-9]+)/;
      if (!tickerPattern.test(message)) return;
      const { data, error } = await invokeFunction('price-bot', { body: { action: 'process-message', message } });
      if (data?.processed) {
        setTimeout(() => loadMessages(), 1000);
      }
    } catch (error) {}
  }

  const handleSlashCommand = (content: string): boolean => {
    const trimmed = content.trim()
    const lower = trimmed.toLowerCase()
    
    if (lower === '/help' || lower === '/?') { setShowCommandHelp(true); return true; }
    if (lower === '/anon') {
      const newAnonState = !displayAsAnonymous;
      setDisplayAsAnonymous(newAnonState);
      localStorage.setItem('chat-anonymous', newAnonState.toString());
      toast.success(newAnonState ? 'Now posting as Anonymous' : 'Now posting with your username');
      return true;
    }
    if (lower === '/online' || lower === '/who') {
      toast.success(`${onlineUsers.length} users online: ${onlineUsers.map(u => u.username).join(', ')}`);
      return true;
    }
    
    // Check for feed command: /feed @talky (x)
    if (lower.startsWith('/feed @talky')) {
      const prompt = trimmed.substring('/feed @talky'.length).trim()
      if (prompt) {
        handleFeedTalky(prompt)
        return true
      }
    }
    
    return false;
  }

  const handleFeedTalky = async (prompt: string) => {
    if (!user) return
    toast.loading('Feeding Talky...', { id: 'feed-talky' })
    try {
      const { data, error } = await invokeFunction('talky-bot', { 
        body: { action: 'feed', prompt, userId: user.id, username: user.username } 
      })
      if (error) throw error
      if (data?.success) {
        toast.success('Talky is cooking up a thread!', { id: 'feed-talky' })
        loadMessages()
      } else {
        throw new Error(data?.error || 'Failed to feed Talky')
      }
    } catch (error) {
      toast.error('Failed to feed Talky', { id: 'feed-talky' })
    }
  }

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous');
      const { data, error } = await invokeFunction('talky-bot', { 
        body: { action: 'get-user-profile', userId: user.id, username: actualUsername } 
      });
      if (data?.profile) {
        setUserProfile(data);
        setShowProfileDialog(true);
      }
    } catch (error) {}
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || !user) return
    
    // Enforce PoW
    if (!hasValidPoW) {
      toast.error('PoW not ready. Please wait.')
      return
    }

    playClickSound()
    try {
      if (content.startsWith('/')) {
        if (handleSlashCommand(content)) return
      }

      // 1. Submit PoW first to "pay" for the message
      const powData = getPoWValidationData()
      if (!powData) {
        toast.error('PoW data missing. Please retry.')
        return
      }

      // Validating PoW asynchronously while sending message
      invokeFunction('validate-pow', {
        body: {
          ...powData,
          targetType: 'global',
          targetId: 'global',
          userId: user.id
        }
      }).catch(err => console.error('Failed to validate PoW for chat:', err))

      // Clear PoW after use to force mining for next message
      miningManagerRef.current.clearLastPoWResult()
      // Restart mining immediately for next message
      miningManagerRef.current.startDedicatedMining('global', 'global', CHAT_DIFFICULTY.points, CHAT_DIFFICULTY.prefix)

      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous')
      const username = displayAsAnonymous ? 'Anon' : actualUsername
      const messageId = `msg-${Date.now()}-${user.id}`
      const createdAt = new Date().toISOString()
      const newMessageObj: ChatMessage = { id: messageId, userId: user.id, username, content, isBot: 0, createdAt }
      
      await db.db.chatMessages.create(newMessageObj)
      db.realtime.publish(REALTIME_CHANNEL, 'message', newMessageObj)
      loadMessages()
      updateActivity()
      
      // Check for mentions in the message just sent to invoke Talky
      if (content.toLowerCase().includes('@talky')) {
        invokeTalky(content)
      }
      
      checkForTickers(content)
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  if (!user) {
    return <div className="h-full flex items-center justify-center font-mono">Loading chat...</div>
  }

  return (
    <>
      <div className="h-full flex border-2 border-foreground">
        <div className="flex-1 flex flex-col">
          <div className="border-b-2 border-foreground p-2 bg-background flex items-center justify-between">
            <h3 className="font-bold font-mono">GLOBAL CHAT</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCommandHelp(true)} className="font-mono text-xs">/help</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg) => {
              const isBot = Number(msg.isBot) > 0
              const isSelf = msg.userId === user.id
              return (
                <div key={msg.id} className={`border border-foreground p-2 ${isBot ? 'bg-muted border-2' : isSelf ? 'bg-foreground text-background' : 'bg-background'}`}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-bold font-mono text-xs flex items-center gap-1">
                      {isBot && <Bot className="w-3 h-3" />}
                      {msg.username}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="font-mono text-xs break-words">{msg.content}</div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <ChatInput 
            onSend={sendMessage} 
            disabled={!user} 
            hasValidPoW={hasValidPoW}
            dedicatedSession={!!dedicatedSession}
            difficulty={CHAT_DIFFICULTY}
          />
        </div>
        <div className="w-48 border-l-2 border-foreground flex flex-col">
          <div className="border-b-2 border-foreground p-2 bg-background flex justify-between">
            <span className="font-bold font-mono text-xs">ONLINE</span>
            <span className="text-xs font-mono">{onlineUsers.length}/{MAX_USERS}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {onlineUsers.map((u) => (
              <div key={u.userId} className="flex items-center gap-2 p-1 border border-foreground">
                <div className="w-2 h-2 bg-foreground rounded-full" />
                <span className="font-mono text-xs truncate">{u.username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Dialog open={showCommandHelp} onOpenChange={setShowCommandHelp}>
        <DialogContent className="font-mono">
          <DialogHeader><DialogTitle>Chat Commands</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="border border-foreground p-2">
              <div className="font-bold mb-1">BASIC COMMANDS</div>
              <ul className="list-disc list-inside space-y-1 opacity-70">
                <li>/help - Show this help</li>
                <li>/anon - Toggle anonymous posting</li>
                <li>/online - List online users</li>
              </ul>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold mb-1">TALKY COMMANDS</div>
              <ul className="list-disc list-inside space-y-1 opacity-70">
                <li>@talky (message) - Mention Talky in chat</li>
                <li>/feed @talky (topic) - Ask Talky to post a thread about a topic</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}