import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Users, Database, Activity, Shield, Key, UserCog, Layout, Trash2, AlertCircle, RefreshCw, Copy, Check, Globe, Zap, Lock, MessageSquare, Calendar, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import db, { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { getUserInviteCodes, grantEpochInviteCodes, getCurrentEpoch } from '../lib/invite-codes'
import { ADMIN_CODES_PER_EPOCH } from '../lib/constants'
import { getSiteSettings, updateSiteSettings, SiteSettings } from '../lib/site-settings'
import { AdminOverview } from '../components/admin/AdminOverview'
import { AdminSettings } from '../components/admin/AdminSettings'
import { AdminInvites } from '../components/admin/AdminInvites'
import { AdminUsers } from '../components/admin/AdminUsers'
import { AdminBoards } from '../components/admin/AdminBoards'
import { AdminTools } from '../components/admin/AdminTools'

export function AdminPanelPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalThreads: 0,
    totalPosts: 0,
    totalPow: 0,
    totalBoards: 0
  })
  
  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<any[]>([])
  const [currentEpoch, setCurrentEpoch] = useState<number>(256)
  const [generating, setGenerating] = useState(false)
  
  // User management state
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [boards, setBoards] = useState<any[]>([])
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'user' | 'invite' | 'board' | null; id: string | null; name: string | null }>({
    open: false,
    type: null,
    id: null,
    name: null
  })

  useEffect(() => {
    let isMounted = true
    
    const performAuth = async () => {
      try {
        if (!authState.user) {
          setLoading(false)
          return
        }
        
        if (!isMounted) return
        
        // Check if user is jcb or admin (isAdmin is stored as "0" or "1" string)
        if (authState.user.username !== 'jcb' && Number(authState.user.isAdmin) === 0) {
          toast.error('Access denied: Admin only')
          navigate('/')
          setLoading(false)
          return
        }
        
        // Load all data after auth check succeeds
        try {
          const [users, threads, posts, boardsList] = await Promise.all([
            publicDb.db.users.list({ limit: 1000 }),
            publicDb.db.threads.list({ limit: 1000 }),
            publicDb.db.posts.list({ limit: 1000 }),
            publicDb.db.boards.list({ limit: 100 })
          ])

          if (!isMounted) return

          const totalPow = users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)

          setStats({
            totalUsers: users.length,
            totalThreads: threads.length,
            totalPosts: posts.length,
            totalPow,
            totalBoards: boardsList.length
          })

          setAllUsers(users)
          setBoards(boardsList)
          
          // Load site settings
          const s = await getSiteSettings(true)
          if (isMounted) setSiteSettings(s)

          // Load invite codes (auth already checked above)
          if (authState.user?.id) {
            const epoch = await getCurrentEpoch()
            setCurrentEpoch(epoch)
            const codes = await getUserInviteCodes(authState.user.id)
            setInviteCodes(codes)
          }

          setLoading(false)
        } catch (dataError) {
          if (isMounted) {
            console.error('Data loading error:', dataError)
            toast.error('Failed to load statistics')
            setLoading(false)
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Auth check error:', error)
          toast.error('Failed to load admin panel')
          navigate('/')
          setLoading(false)
        }
      }
    }

    performAuth()
    
    return () => {
      isMounted = false
    }
  }, [navigate, authState.user])
  


  const loadInviteCodes = useCallback(async () => {
    if (authState.user?.id) {
      const epoch = await getCurrentEpoch()
      setCurrentEpoch(epoch)
      const codes = await getUserInviteCodes(authState.user.id)
      setInviteCodes(codes)
    }
  }, [authState.user?.id])

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSiteSettings(true)
      setSiteSettings(s)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  const loadAllData = useCallback(async () => {
    try {
      const [users, threads, posts, boardsList] = await Promise.all([
        publicDb.db.users.list({ limit: 1000 }),
        publicDb.db.threads.list({ limit: 1000 }),
        publicDb.db.posts.list({ limit: 1000 }),
        publicDb.db.boards.list({ limit: 100 })
      ])

      const totalPow = users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)

      setStats({
        totalUsers: users.length,
        totalThreads: threads.length,
        totalPosts: posts.length,
        totalPow,
        totalBoards: boardsList.length
      })

      setAllUsers(users)
      setBoards(boardsList)

      // Reload settings
      await loadSettings()

      // Reload invite codes
      await loadInviteCodes()

      toast.success('Data refreshed!')
    } catch (error) {
      console.error('Failed to refresh data:', error)
      toast.error('Failed to refresh data')
    }
  }, [loadInviteCodes, loadSettings])
  
  const handleGenerateCodes = async () => {
    if (!authState.user?.id) return
    
    // Only jcb can generate codes
    if (authState.user?.username !== 'jcb') {
      toast.error('Only the admin user "jcb" can generate invite codes')
      return
    }
    
    setGenerating(true)
    try {
      const isAdmin = Number(authState.user?.isAdmin) > 0
      await grantEpochInviteCodes(authState.user.id, isAdmin)
      toast.success(`Generated ${isAdmin ? ADMIN_CODES_PER_EPOCH : 1} new invite code(s)!`)
      await loadAllData()
    } catch (error) {
      toast.error('Failed to generate invite codes')
    } finally {
      setGenerating(false)
    }
  }
  
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy')
    }
  }
  
  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return
    
    try {
      switch (deleteDialog.type) {
        case 'user':
          await db.db.users.delete(deleteDialog.id)
          toast.success('User deleted successfully')
          await loadAllData()
          break
        case 'invite':
          await db.db.inviteCodes.delete(deleteDialog.id)
          toast.success('Invite code deleted successfully')
          await loadInviteCodes()
          break
        case 'board':
          {
            const boardId = deleteDialog.id

            // Cascade delete: posts -> threads -> board
            const threads = await publicDb.db.threads.list({ where: { boardId }, limit: 1000 })
            for (const t of threads) {
              await db.db.posts.deleteMany({ where: { threadId: t.id } })
              await db.db.threads.delete(t.id)
            }

            await db.db.boards.delete(boardId)
            toast.success('Board deleted successfully')
            await loadAllData()
          }
          break
      }
    } catch (error) {
      toast.error(`Failed to delete ${deleteDialog.type}`)
      console.error('Delete error:', error)
    } finally {
      setDeleteDialog({ open: false, type: null, id: null, name: null })
    }
  }

  const handleUpdateSettings = async (updates: Partial<SiteSettings>) => {
    if (!siteSettings) return
    setSavingSettings(true)
    try {
      const updated = await updateSiteSettings(updates)
      setSiteSettings(updated)
      toast.success('Settings updated successfully')
    } catch (error) {
      toast.error('Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Verifying admin access</div>
        </div>
      </div>
    )
  }
  
  // Filter invite codes
  const unusedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount < maxUses
  })
  const usedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount >= maxUses
  })

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-7xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-mono flex items-center gap-3">
                <Shield className="w-7 h-7" />
                ADMIN CONTROL PANEL
              </h1>
              <p className="text-xs font-mono mt-2 text-muted-foreground">
                Full system administration • Logged in as: <span className="font-bold text-white">{authState.user?.username}</span> • Role: ADMIN
              </p>
            </div>
            <Button
              onClick={loadAllData}
              variant="outline"
              className="bg-card text-foreground hover:bg-muted font-mono border-2 border-foreground"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              REFRESH ALL
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-4 border-foreground">
            <CardContent className="pt-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalUsers}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">USERS</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-foreground">
            <CardContent className="pt-4 text-center">
              <Database className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalThreads + stats.totalPosts}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">POSTS</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-foreground">
            <CardContent className="pt-4 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalPow.toLocaleString()}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">POW</p>
            </CardContent>
          </Card>
          <Card className="border-4 border-foreground">
            <CardContent className="pt-4 text-center">
              <Layout className="w-8 h-8 mx-auto mb-2" />
              <div className="text-3xl font-bold font-mono">{stats.totalBoards}</div>
              <p className="text-xs font-mono text-muted-foreground mt-1">BOARDS</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 bg-card text-card-foreground border-4 border-foreground h-auto">
            <TabsTrigger value="overview" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <Shield className="hidden md:block w-4 h-4 mr-2" />
              OVERVIEW
            </TabsTrigger>
            <TabsTrigger value="settings" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <Settings className="hidden md:block w-4 h-4 mr-2" />
              SETTINGS
            </TabsTrigger>
            <TabsTrigger value="invites" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <Key className="hidden md:block w-4 h-4 mr-2" />
              INVITES
            </TabsTrigger>
            <TabsTrigger value="users" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <UserCog className="hidden md:block w-4 h-4 mr-2" />
              USERS
            </TabsTrigger>
            <TabsTrigger value="boards" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <Layout className="hidden md:block w-4 h-4 mr-2" />
              BOARDS
            </TabsTrigger>
            <TabsTrigger value="tools" className="font-mono data-[state=active]:bg-foreground data-[state=active]:text-background py-3 text-[10px] md:text-sm">
              <Database className="hidden md:block w-4 h-4 mr-2" />
              TOOLS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview stats={stats} />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings 
              siteSettings={siteSettings} 
              savingSettings={savingSettings} 
              handleUpdateSettings={handleUpdateSettings} 
            />
          </TabsContent>

          <TabsContent value="invites">
            <AdminInvites 
              unusedCodes={unusedCodes}
              usedCodes={usedCodes}
              generating={generating}
              currentEpoch={currentEpoch}
              username={authState.user?.username}
              handleGenerateCodes={handleGenerateCodes}
              copyToClipboard={copyToClipboard}
              setDeleteDialog={setDeleteDialog}
            />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsers 
              allUsers={allUsers}
              setDeleteDialog={setDeleteDialog}
            />
          </TabsContent>

          <TabsContent value="boards">
            <AdminBoards 
              boards={boards}
              setDeleteDialog={setDeleteDialog}
            />
          </TabsContent>

          <TabsContent value="tools">
            <AdminTools loadAllData={loadAllData} />
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent className="border-4 border-black font-mono">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                CONFIRM DELETION
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono">
                Are you sure you want to delete this {deleteDialog.type}?
                <span className="block mt-2 font-bold text-black">
                  {deleteDialog.name}
                </span>
                <span className="block mt-2 text-red-600 text-xs">
                  This action cannot be undone. All related data will be permanently removed.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono">CANCEL</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 font-mono"
              >
                DELETE
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
