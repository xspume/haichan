import { useState, useEffect } from 'react'
import { Megaphone, Trash2, Plus, Send } from 'lucide-react'
import db, { publicDb } from '../../lib/db-client'
import { useAuth } from '../../contexts/AuthContext'
import { playClickSound, playSuccessSound } from '../../lib/sound-utils'
import { requestCache } from '../../lib/request-cache'
import { withRateLimit, isTransientError } from '../../lib/rate-limit-utils'

interface Announcement {
  id: string
  userId: string
  username: string
  content: string
  createdAt: string
}

export function Announcements() {
  const { dbUser } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [newAnnouncement, setNewAnnouncement] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Robust admin check: username is 'jcb' OR isAdmin flag is set in database
    const isAdminUser = dbUser?.username === 'jcb' || dbUser?.id === 'jcb' || Number(dbUser?.isAdmin) > 0
    setIsAdmin(isAdminUser)
    loadAnnouncements()
  }, [dbUser])

  const loadAnnouncements = async () => {
    try {
      // Announcements are global (typically posted by admins). Never scope by current user.
      const data = await requestCache.getOrFetch<Announcement[]>(
        'announcements-list',
        () => withRateLimit(
          () => publicDb.db.announcements.list({
            orderBy: { createdAt: 'desc' },
            limit: 5
          }),
          { maxRetries: 3, initialDelayMs: 250, timeoutMs: 45000 }
        ),
        300000 // 5 minute cache
      )
      setAnnouncements(data || [])
    } catch (error) {
      console.error('Failed to load announcements:', error)
    }
  }

  const handlePost = async () => {
    if (!newAnnouncement.trim() || isPosting) return
    
    setIsPosting(true)
    playClickSound()
    
    try {
      await db.db.announcements.create({
        userId: dbUser!.id,
        username: dbUser!.username || 'jcb',
        content: newAnnouncement.trim()
      })
      
      setNewAnnouncement('')
      requestCache.invalidate('announcements-list')
      await loadAnnouncements()
      playSuccessSound()
    } catch (error) {
      console.error('Failed to post announcement:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return
    playClickSound()
    
    try {
      await db.db.announcements.delete(id)
      requestCache.invalidate('announcements-list')
      await loadAnnouncements()
    } catch (error) {
      console.error('Failed to delete announcement:', error)
    }
  }

  if (announcements.length === 0 && !isAdmin) return null

  return (
    <div className="card-3d p-4 bg-primary/5 border-2 border-primary/20 relative overflow-hidden shadow-3d-sm">
      <div className="flex items-center justify-between mb-4 border-b border-primary/20 pb-2">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
          <Megaphone className="w-3 h-3 text-primary animate-pulse" />
          Announcements
        </h3>
        {isAdmin && (
          <div className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 border border-primary/30">
            Admin Access
          </div>
        )}
      </div>

      <div className="space-y-4">
        {announcements.length === 0 && isAdmin && (
          <div className="text-center py-8 border-2 border-dashed border-primary/20 opacity-50">
            <p className="text-[10px] uppercase font-bold tracking-wider">No active announcements</p>
            <p className="text-[8px] opacity-60 mt-1">Post a new one below</p>
          </div>
        )}

        {announcements.map((a) => (
          <div key={a.id} className="relative group p-3 bg-card border-2 border-primary/10 hover:border-primary/30 transition-all shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black text-primary uppercase tracking-tighter opacity-60">
                {new Date(a.createdAt).toLocaleString()}
              </span>
              {isAdmin && (
                <button 
                  onClick={() => handleDelete(a.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 transition-all"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
            <p className="text-[13px] font-sans leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">{a.content}</p>
          </div>
        ))}

        {isAdmin && (
          <div className="mt-4 space-y-2 border-t border-primary/10 pt-4">
            <textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Post new announcement..."
              className="w-full bg-background border-2 border-primary/20 p-2 text-xs font-sans focus:border-primary outline-none min-h-[60px] leading-relaxed transition-colors"
            />
            <button
              onClick={handlePost}
              disabled={isPosting || !newAnnouncement.trim()}
              className="btn-haichan w-full py-2 text-[10px] flex items-center justify-center gap-2 uppercase font-black tracking-widest shadow-lg"
            >
              {isPosting ? 'Posting...' : <><Plus size={14} /> Create Announcement</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
