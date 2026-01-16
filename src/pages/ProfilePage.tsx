import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Trophy, Calendar, Wallet } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { dbUser: currentUser } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const isOwnProfile = !userId || userId === currentUser?.id

  useEffect(() => {
    async function loadProfile() {
      try {
        const targetUserId = userId || currentUser?.id
        if (!targetUserId) {
          setLoading(false)
          return
        }

        const users = await publicDb.db.users.list({
          where: { id: targetUserId },
          limit: 1
        })

        if (users && users.length > 0) {
          setUser(users[0])
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [userId, currentUser?.id])

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  const displayUser = isOwnProfile ? (currentUser || user) : user

  if (!displayUser) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">USER NOT FOUND</div>
          <Button onClick={() => navigate('/')} variant="outline">
            GO HOME
          </Button>
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
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 border-4 border-foreground flex items-center justify-center">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono">
                {displayUser.displayName || displayUser.username || 'Anonymous'}
              </h1>
              {displayUser.username && (
                <p className="text-muted-foreground font-mono">@{displayUser.username}</p>
              )}
              {isOwnProfile && (
                <Button
                  onClick={() => navigate('/settings')}
                  variant="outline"
                  size="sm"
                  className="mt-2 font-mono"
                >
                  EDIT PROFILE
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 border-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                TOTAL POW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {(displayUser.totalPowPoints || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                JOINED
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-mono">
                {displayUser.createdAt
                  ? new Date(displayUser.createdAt).toLocaleDateString()
                  : 'Unknown'}
              </div>
            </CardContent>
          </Card>

          {displayUser.bitcoinAddress && (
            <Card className="border-2 border-foreground md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  BITCOIN ADDRESS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-mono break-all">
                  {displayUser.bitcoinAddress}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
