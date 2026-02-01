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
    <div className="min-h-screen bg-background flex flex-col font-sans pt-8 lg:pt-10">
      <DiagnosticsBanner />

      {/* Top Fixed Toolbars (90s Style) */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-black border-b border-primary/40 flex items-center h-8 lg:h-10 px-2 divide-x divide-primary/20 overflow-x-auto no-scrollbar">
        <div className="shrink-0">
          <BoardsToolbar />
        </div>
        <div className="shrink-0 h-full flex items-center">
          <HubsToolbar />
        </div>
      </div>

      {/* Global Banners */}
      {!!siteSettings?.maintenanceMode && (
        <div className="bg-destructive text-destructive-foreground text-[10px] py-1 text-center font-black tracking-widest border-b border-primary z-[60] animate-pulse">
          SYSTEM MAINTENANCE MODE ACTIVE - READ ONLY FOR NON-ADMINS
        </div>
      )}
      
      {!!siteSettings?.motd && (
        <div className="bg-primary text-background text-[11px] py-1 text-center font-black border-b border-primary/20 flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap z-[60] tracking-widest">
          <Sparkles className="w-3 h-3 flex-shrink-0 animate-pulse" />
          <span className="animate-marquee-slow uppercase">{siteSettings.motd}</span>
          <Sparkles className="w-3 h-3 flex-shrink-0 animate-pulse" />
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b-2 border-primary bg-black sticky top-8 lg:top-10 z-50 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center justify-center w-10 h-10 bg-background border-2 border-primary shadow-3d-sm">
            <Glasses className="w-6 h-6 text-primary" />
          </Link>
          
          <div className="hidden lg:flex items-center gap-2">
            {/* Toolbars moved to top fixed bar */}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 3D Mode Toggle */}
          <button
            onClick={toggle3D}
            className={cn(
              "p-1.5 transition-all duration-200 border-2 no-3d bg-background shadow-sm",
              is3DEnabled
                ? "btn-3d-toggle active border-primary"
                : "border-primary/20 hover:border-primary text-primary hover:bg-primary/10"
            )}
            title={is3DEnabled ? "Disable 3D Mode" : "Enable 3D Mode (Red/Cyan Glasses)"}
          >
            <Glasses className="w-4 h-4" />
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="hidden sm:flex items-center gap-1 text-primary hover:underline text-[10px] font-black uppercase tracking-tight">
                {username || 'user'}
                <BadgesInline user={dbUser} className="scale-75" />
              </Link>
              
              <Link to="/notifications" className="relative p-1.5 text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20">
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] px-1 font-black animate-pulse border border-background">
                    {notificationCount}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-2 border-primary hover:bg-primary hover:text-background transition-all shadow-sm">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background border-2 border-primary rounded-none shadow-3d-lg mt-1 font-sans">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer py-2.5 px-3 hover:bg-primary/10 transition-colors">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer py-2.5 px-3 hover:bg-primary/10 transition-colors">
                      <Settings className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase tracking-widest">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user?.username === 'jcb' || Number(user?.isAdmin) > 0) && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2 cursor-pointer py-2.5 px-3 text-primary hover:bg-primary/10 transition-colors">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest">Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-primary/20 h-0.5" />
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer py-2.5 px-3 text-destructive hover:bg-destructive/10 transition-colors">
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link to="/auth" className="relative group px-4 py-1 border-2 border-primary bg-background text-primary text-[12px] font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]">
              <span className="relative z-10">Login</span>
              <div className="absolute -bottom-1.5 -right-1.5 w-full h-full bg-primary -z-10 group-active:-bottom-0 group-active:-right-0 transition-all" />
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 w-10 h-10 flex items-center justify-center bg-background border-2 border-primary text-primary hover:bg-primary/10 transition-colors shadow-sm"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile-Friendly Quick Toolbar (Matches Screenshot) */}
      <div className="lg:hidden border-b-2 border-primary/20 bg-black px-4 py-2 flex items-center gap-3 sticky top-24 z-40">
        <Link to="/mine" className="relative group px-3 py-1 border-2 border-primary bg-background text-primary text-[11px] font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]">
          <span className="relative z-10">Start Mining</span>
          <div className="absolute -bottom-1 -right-1 w-full h-full bg-primary -z-10 group-active:-bottom-0 group-active:-right-0 transition-all" />
        </Link>
        <Link to="/chat" className="relative group px-3 py-1 border-2 border-primary bg-background text-primary text-[11px] font-black uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px]">
          <span className="relative z-10">Global Chat</span>
          <div className="absolute -bottom-1 -right-1 w-full h-full bg-primary -z-10 group-active:-bottom-0 group-active:-right-0 transition-all" />
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Slender Desktop Sidebar */}
        <aside className="hidden lg:flex w-48 flex-col border-r-2 border-primary/20 bg-black h-full overflow-y-auto custom-scrollbar shadow-sm">
          <nav className="p-2 space-y-1">
            {sidebarItems.map((item) => (
              <Link 
                key={item.to} 
                to={item.to}
                className="flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-background transition-colors border border-transparent hover:border-primary/40 group shadow-none hover:shadow-sm"
              >
                <span className="text-primary group-hover:text-background transition-colors">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            
            {user && (
              <div className="pt-4 mt-4 border-t-2 border-primary/10">
                <div className="px-3 py-1 text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-2 opacity-60">My Status</div>
                <div className="px-3 py-2 border-2 border-primary/40 bg-background shadow-sm mb-4 mx-1">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="opacity-60 font-bold tracking-tighter">POWER</span>
                    <span className="text-primary font-black">{dbUser?.totalPowPoints || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="opacity-60 font-bold tracking-tighter">DIAMOND</span>
                    <span className="text-primary font-black">LVL {dbUser?.diamondLevel || 0}</span>
                  </div>
                </div>
                
                <div className="px-3 py-2 text-[9px] text-primary/40 font-bold italic leading-tight uppercase tracking-tighter">
                  Press M to toggle mining.
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