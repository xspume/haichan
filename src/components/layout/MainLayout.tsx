/**
 * MainLayout - Refactored with proper auth context integration
 * Replaces all manual onAuthStateChanged subscriptions with useAuth hook
 */
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import { BottomToolbar } from './BottomToolbar'
import { BoardsToolbar } from './BoardsToolbar'
import { HubsToolbar } from './HubsToolbar'
import { DiagnosticsBanner } from './DiagnosticsBanner'
import { BadgesInline } from '../../lib/badge-utils'
import { Layers, BookOpen, Pickaxe, User, LogOut, Trophy, Ticket, MessageSquare, Image, Settings, Shield, Users, Zap, Menu, X, Scroll, ChevronDown, Palette, Bell, Hash, Home, Sparkles, TrendingUp, Clock, LogIn, LayoutGrid, Glasses } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { POW_ESTIMATED_TIME } from '../../lib/constants'
import { formatBrandName } from '../../lib/utils'
import { MiningManager } from '../../lib/mining/MiningManager'
import { getSiteSettings, SiteSettings } from '../../lib/site-settings'
import db from '../../lib/db-client'
import { cn } from '../../lib/utils'
import { MiningOverlay } from '../mining/MiningOverlay'
import { use3DMode } from '../../contexts/ThreeDModeContext'

export function MainLayout() {
  const { authState, dbUser, signOut, siteSettings } = useAuth()
  const { is3DEnabled, toggle3D } = use3DMode()
  const [username, setUsername] = useState<string>('')
  const [blogName, setBlogName] = useState<string>('')
  const [notificationCount, setNotificationCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const keydownListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const isAuthenticated = authState.isAuthenticated
  const user = authState.user

  // Keyboard shortcut for mining (M key) - only for authenticated users
  // Use ref to maintain stable handler reference across renders
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.key === 'M' || e.key === 'm') && authState.user) {
        e.preventDefault()
        const manager = MiningManager.getInstance()
        const dedicatedSession = manager.getSession('dedicated')

        if (dedicatedSession) {
          // Stop dedicated mining
          manager.stopDedicatedMining()
          toast.success('Dedicated mining stopped')
        } else {
          // Start dedicated mining
          manager.startDedicatedMining('user', undefined, 15, '21e8')
          toast.success('Dedicated mining started! Press M to stop.')
        }
      }
    }

    // Store handler reference for cleanup
    keydownListenerRef.current = handleKeyPress

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      keydownListenerRef.current = null
    }
  }, [authState.user])

  // Load user metadata and notifications
  useEffect(() => {
    if (dbUser) {
      setUsername(dbUser.username || dbUser.displayName || 'user')
      loadBlogName(dbUser.id)
      loadNotifications(dbUser.id)
    } else {
      setUsername('')
      setBlogName('')
      setNotificationCount(0)
    }
  }, [dbUser])

  const loadBlogName = async (userId: string) => {
    try {
      const { requestCache } = await import('../../lib/request-cache')
      
      // Load user's blog name from cache or database
      const userBlogs = await requestCache.getOrFetch<any[]>(
        `user-blog-${userId}`,
        () => db.db.blogPosts.list({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          limit: 1
        }),
        30000
      )
      
      if (userBlogs && userBlogs.length > 0 && userBlogs[0].blogName) {
        setBlogName(userBlogs[0].blogName)
      }
    } catch (error) {
      console.error('Failed to load blog name:', error)
    }
  }

  const loadNotifications = async (userId: string) => {
    try {
      const { withRateLimit } = await import('../../lib/rate-limit-utils')
      const count = await withRateLimit(() => db.db.notifications.count({
        where: { userId, isRead: 0 }
      }), { maxRetries: 3, initialDelayMs: 200 })
      setNotificationCount(typeof count === 'number' ? count : 0)
    } catch (e) {
      console.error('Failed to load notifications', e)
    }
  }

  const handleLogout = useCallback(async () => {
    try {
      await signOut()
      toast.success('Logged out')
      navigate('/auth')
    } catch (error) {
      toast.error('Logout failed')
    }
  }, [signOut, navigate])

  const sidebarItems = [
    { to: "/", icon: <Home className="w-4 h-4" />, label: "home" },
    { to: "/boards", icon: <LayoutGrid className="w-4 h-4" />, label: "boards" },
    { to: "/mine", icon: <Pickaxe className="w-4 h-4" />, label: "mine" },
    { to: "/chat", icon: <MessageSquare className="w-4 h-4" />, label: "chat" },
    { to: "/canvas", icon: <Palette className="w-4 h-4" />, label: "canvas" },
    { to: "/games", icon: <Zap className="w-4 h-4" />, label: "games" },
    { to: "/images", icon: <Image className="w-4 h-4" />, label: "images" },
    { to: "/blogs", icon: <BookOpen className="w-4 h-4" />, label: "blogs" },
    { to: "/themes", icon: <Palette className="w-4 h-4" />, label: "themes" },
    { to: "/work-ledger", icon: <TrendingUp className="w-4 h-4" />, label: "ledger" },
    { to: "/about", icon: <Shield className="w-4 h-4" />, label: "info" },
    { to: "/thesis", icon: <Scroll className="w-4 h-4" />, label: "thesis" },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col font-mono">
      <DiagnosticsBanner />

      {/* Global Banners */}
      {!!siteSettings?.maintenanceMode && (
        <div className="bg-red-600 text-white text-[10px] py-1 text-center font-bold tracking-wider border-b border-black z-[60]">
          SYSTEM MAINTENANCE MODE ACTIVE - READ ONLY FOR NON-ADMINS
        </div>
      )}
      
      {!!siteSettings?.motd && (
        <div className="bg-primary text-background text-[11px] py-1 text-center font-bold border-b border-black flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap z-[60]">
          <Sparkles className="w-3 h-3 flex-shrink-0 animate-pulse" />
          <span className="animate-marquee-slow">{siteSettings.motd}</span>
          <Sparkles className="w-3 h-3 flex-shrink-0 animate-pulse" />
        </div>
      )}

      {/* Header */}
      <header className="h-12 border-b border-primary bg-background sticky top-0 z-50 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="haichan-logo">
            HAICHAN
          </Link>
          
          <div className="hidden lg:flex items-center gap-2">
            <BoardsToolbar />
            <HubsToolbar />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 3D Mode Toggle */}
          <button
            onClick={toggle3D}
            className={cn(
              "p-1.5 transition-all duration-200 border no-3d bg-background text-foreground shadow-3d-sm",
              is3DEnabled
                ? "btn-3d-toggle active border-primary"
                : "border-primary hover:border-primary/80 hover:bg-primary/10"
            )}
            title={is3DEnabled ? "Disable 3D Mode" : "Enable 3D Mode (Red/Cyan Glasses)"}
          >
            <Glasses className="w-4 h-4" />
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="hidden sm:flex items-center gap-1 text-primary hover:underline text-xs">
                {username || 'user'}
                <BadgesInline user={dbUser} className="scale-75" />
              </Link>
              
              <Link to="/notifications" className="relative p-1 text-primary hover:bg-primary/10 transition-colors">
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] px-1 rounded-full animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 border border-primary hover:bg-primary hover:text-background transition-all">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background border-2 border-primary rounded-none shadow-3d mt-1">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer py-2 hover:bg-primary/10">
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer py-2 hover:bg-primary/10">
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user?.username === 'jcb' || Number(user?.isAdmin) > 0) && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2 cursor-pointer py-2 text-primary font-bold hover:bg-primary/10">
                        <Shield className="w-4 h-4" />
                        <span>Admin</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-primary/30" />
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer py-2 text-red-500 hover:bg-red-500/10">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link to="/auth" className="btn-3d text-[10px] py-1">
              Login
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1 border border-primary hover:bg-primary hover:text-background transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Slender Desktop Sidebar */}
        <aside className="hidden lg:flex w-48 flex-col border-r border-primary bg-background/50 h-full overflow-y-auto custom-scrollbar">
          <nav className="p-2 space-y-1">
            {sidebarItems.map((item) => (
              <Link 
                key={item.to} 
                to={item.to}
                className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-primary hover:text-background transition-colors border border-transparent hover:border-primary group"
              >
                <span className="text-primary group-hover:text-background transition-colors">{item.icon}</span>
                <span className="uppercase tracking-wider">{item.label}</span>
              </Link>
            ))}
            
            {user && (
              <div className="pt-4 mt-4 border-t border-primary/20">
                <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-2">My Account</div>
                <div className="px-3 py-2 border-2 border-primary bg-background shadow-3d-sm mb-4">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="opacity-60">POWER</span>
                    <span className="text-primary font-bold">{dbUser?.totalPowPoints || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="opacity-60">DIAMOND</span>
                    <span className="text-primary font-bold">LVL {dbUser?.diamondLevel || 0}</span>
                  </div>
                </div>
                
                <div className="px-3 py-2 text-[9px] text-primary/60 italic leading-tight">
                  Press M to toggle dedicated mining anytime.
                </div>
              </div>
            )}
          </nav>
        </aside>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute inset-0 z-40 bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
            <nav className="p-4 space-y-2">
              {sidebarItems.map((item) => (
                <Link 
                  key={item.to} 
                  to={item.to} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 px-4 py-3 text-sm border-2 border-primary hover:bg-primary hover:text-background transition-all shadow-3d-sm"
                >
                  {item.icon}
                  <span className="uppercase font-bold tracking-wider">{item.label}</span>
                </Link>
              ))}
              
              {!user && (
                <Link 
                  to="/auth" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 px-4 py-3 text-sm border-2 border-primary bg-primary text-background font-bold uppercase tracking-wider"
                >
                  <LogIn className="w-4 h-4" />
                  Login / Register
                </Link>
              )}
            </nav>
          </div>
        )}

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-16 lg:pb-8">
          <div
            className={cn(
              'mx-auto',
              location.pathname === '/mine'
                ? 'max-w-none px-2 md:px-4 lg:px-6 py-3 md:py-4 lg:py-6'
                : 'max-w-6xl p-4 md:p-6 lg:p-8'
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar />

      {/* Mining Progress Overlay */}
      <MiningOverlay />

      {/* 3D Mode Indicator Badge */}
      {is3DEnabled && (
        <div className="anaglyph-3d-badge no-3d">
          3D MODE
        </div>
      )}
    </div>
  )
}

export default MainLayout
