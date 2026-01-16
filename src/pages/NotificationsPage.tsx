import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Check } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuth } from '../contexts/AuthContext'
import db from '../lib/db-client'
import toast from 'react-hot-toast'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotifications() {
      try {
        if (!dbUser) return

        const notifs = await db.db.notifications?.list?.({
          where: { userId: dbUser.id },
          limit: 50
        }) || []
        setNotifications(notifs)
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [dbUser])

  const markAllRead = async () => {
    try {
      for (const notif of notifications.filter(n => !n.read)) {
        await db.db.notifications?.update?.(notif.id, { read: true })
      }
      setNotifications(notifications.map(n => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark notifications:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-mono flex items-center gap-3">
              <Bell className="w-6 h-6" />
              NOTIFICATIONS
            </h1>
            {notifications.some(n => !n.read) && (
              <Button onClick={markAllRead} variant="outline" size="sm" className="font-mono">
                <Check className="w-4 h-4 mr-2" />
                MARK ALL READ
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-mono">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`border-2 p-4 ${notif.read ? 'border-muted' : 'border-foreground bg-muted/50'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono">{notif.message || notif.title || 'Notification'}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
