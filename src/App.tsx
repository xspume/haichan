import { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThreeDModeProvider } from './contexts/ThreeDModeContext'
import { Toaster } from 'react-hot-toast'
import { MiningManager } from './lib/mining/MiningManager'
import { applyStoredTheme } from './lib/theme-utils'

function LegacyBoardRedirect() {
  const path = window.location.pathname
  // Strip leading/trailing slashes to get the slug (e.g. "/gen/" -> "gen")
  const slug = path.replace(/^\/+|\/+$/g, '')
  if (!slug) return <Navigate to="/" replace />
  return <Navigate to={`/board/${slug}`} replace />
}

// Lazy load pages for better performance
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const BoardsPage = lazy(() => import('./pages/BoardsPage').then(m => ({ default: m.BoardsPage })))
const ThreadsPage = lazy(() => import('./pages/ThreadsPage').then(m => ({ default: m.ThreadsPage })))
const ThemesPage = lazy(() => import('./pages/ThemesPage'))
const BlogsPage = lazy(() => import('./pages/BlogsPage').then(m => ({ default: m.BlogsPage })))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage').then(m => ({ default: m.BlogPostPage })))
const NewBlogPostPage = lazy(() => import('./pages/NewBlogPostPage').then(m => ({ default: m.NewBlogPostPage })))
const UserBlogPage = lazy(() => import('./pages/UserBlogPage').then(m => ({ default: m.UserBlogPage })))
const BlogCustomizationPage = lazy(() => import('./pages/BlogCustomizationPage').then(m => ({ default: m.BlogCustomizationPage })))
const NewThreadPage = lazy(() => import('./pages/NewThreadPage').then(m => ({ default: m.NewThreadPage })))
const NewReplyPage = lazy(() => import('./pages/NewReplyPage').then(m => ({ default: m.NewReplyPage })))
const ThreadDetailPage = lazy(() => import('./pages/ThreadDetailPage').then(m => ({ default: m.ThreadDetailPage })))
const MinePage = lazy(() => import('./pages/MinePage').then(m => ({ default: m.MinePage })))
const CanvasPage = lazy(() => import('./pages/CanvasPage').then(m => ({ default: m.CanvasPage })))
const AdminInvitesPage = lazy(() => import('./pages/AdminInvitesPage').then(m => ({ default: m.AdminInvitesPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })))
const ChatRoomsPage = lazy(() => import('./pages/ChatRoomsPage').then(m => ({ default: m.ChatRoomsPage })))
const CreateBoardPage = lazy(() => import('./pages/CreateBoardPage').then(m => ({ default: m.CreateBoardPage })))
const CreateChatRoomPage = lazy(() => import('./pages/CreateChatRoomPage').then(m => ({ default: m.CreateChatRoomPage })))
const GamesPage = lazy(() => import('./pages/GamesPage').then(m => ({ default: m.GamesPage })))
const HashlePage = lazy(() => import('./pages/HashlePage').then(m => ({ default: m.HashlePage })))
const ImagesPage = lazy(() => import('./pages/ImagesPage').then(m => ({ default: m.ImagesPage })))
const LastUsedImagesPage = lazy(() => import('./pages/LastUsedImagesPage').then(m => ({ default: m.LastUsedImagesPage })))
const MigrateImagesPage = lazy(() => import('./pages/MigrateImagesPage').then(m => ({ default: m.MigrateImagesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage').then(m => ({ default: m.AdminPanelPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const ThesisPage = lazy(() => import('./pages/ThesisPage').then(m => ({ default: m.ThesisPage })))
const SeedPage = lazy(() => import('./pages/SeedPage'))
const WorkLedgerPage = lazy(() => import('./pages/WorkLedgerPage').then(m => ({ default: m.WorkLedgerPage })))
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const OrbCallbackPage = lazy(() => import('./pages/OrbCallbackPage').then(m => ({ default: m.OrbCallbackPage })))

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center font-mono">
      <div className="text-2xl mb-2 animate-pulse">▓▓▓▓▓▓▓▓</div>
      <div className="text-sm">LOADING...</div>
    </div>
  </div>
)

/**
 * Protected route component that redirects unauthenticated users
 * Uses AuthContext for centralized auth state management
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">▓▓▓▓▓▓▓▓</div>
          <div className="text-sm">LOADING...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

/**
 * App Routes Component
 * Contains all route definitions and protected route logic
 */
function AppRoutes() {
  // Initialize background mining on app startup
  useEffect(() => {
    try {
      console.log('[App] Initializing MiningManager...')
      const manager = MiningManager.getInstance()
      
      // Delay background mining by 2.5 seconds to improve initial UI paint
      const timer = setTimeout(() => {
        console.log('[App] Starting background mining (delayed)...')
        manager.startBackgroundMining('global')
        console.log('[App] ✓ Background mining ACTIVE')
      }, 2500)

      return () => {
        clearTimeout(timer)
        try {
          console.log('[App] Cleaning up MiningManager')
        } catch (error) {
          console.error('[App] Error during cleanup:', error)
        }
      }
    } catch (error) {
      console.error('[App] Failed to initialize mining:', error)
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="bottom-right" />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/orb/callback" element={<OrbCallbackPage />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/register" element={<Navigate to="/auth" replace />} />
            <Route path="/seed" element={<SeedPage />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/thesis" element={<ThesisPage />} />
              
              <Route path="/work-ledger" element={<WorkLedgerPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/info" element={<Navigate to="/about" replace />} />
              <Route path="/events" element={<Navigate to="/about" replace />} />
              
              {/* Public Board Routes */}
              <Route path="/board/:boardSlug" element={<ThreadsPage />} />
              <Route path="/board/:boardSlug/thread/:threadId" element={<ThreadDetailPage />} />
              <Route path="/boards" element={<BoardsPage />} />

              {/* Legacy 4chan-style board URLs */}
              <Route path="/:boardSlug" element={<LegacyBoardRedirect />} />
              <Route path="/:boardSlug/" element={<LegacyBoardRedirect />} />
              
              {/* Protected Board Actions */}
              <Route path="/board/:boardSlug/thread/:threadId/reply" element={
                <ProtectedRoute>
                  <NewReplyPage />
                </ProtectedRoute>
              } />
              <Route path="/board/:boardSlug/new" element={
                <ProtectedRoute>
                  <NewThreadPage />
                </ProtectedRoute>
              } />
              <Route path="/boards/create" element={
                <ProtectedRoute>
                  <CreateBoardPage />
                </ProtectedRoute>
              } />

              {/* Public Blog Routes */}
              <Route path="/blogs" element={<BlogsPage />} />
              <Route path="/blog/:id" element={<BlogPostPage />} />
              <Route path="/blog/user/:username" element={<UserBlogPage />} />

              {/* Protected Blog Actions */}
              <Route path="/blogs/new" element={
                <ProtectedRoute>
                  <NewBlogPostPage />
                </ProtectedRoute>
              } />
              <Route path="/blog/customize" element={
                <ProtectedRoute>
                  <BlogCustomizationPage />
                </ProtectedRoute>
              } />
              
              <Route path="/notifications" element={<NotificationsPage />} />
              
              {/* Protected Mining & Personal */}
              <Route path="/mine" element={
                <ProtectedRoute>
                  <MinePage />
                </ProtectedRoute>
              } />
              
              <Route path="/canvas" element={<CanvasPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/hashle" element={<HashlePage />} />
              
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/rooms" element={<ChatRoomsPage />} />
              <Route path="/rooms/create" element={
                <ProtectedRoute>
                  <CreateChatRoomPage />
                </ProtectedRoute>
              } />

              <Route path="/images" element={<ImagesPage />} />
              <Route path="/images/last-used" element={<LastUsedImagesPage />} />
              <Route path="/images/migrate" element={
                <ProtectedRoute>
                  <MigrateImagesPage />
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              
              {/* Profile - My profile protected, public profile public */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/profile/:userId" element={<ProfilePage />} />

              {/* Admin Protected */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminPanelPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/invites" element={
                <ProtectedRoute>
                  <AdminInvitesPage />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

/**
 * Main App Component
 * Wraps all routes with AuthProvider for centralized auth state
 */
function App() {
  // Apply theme on startup
  useEffect(() => {
    try {
      applyStoredTheme()
    } catch (error) {
      console.error('[App] Failed to apply theme:', error)
    }
  }, [])

  return (
    <AuthProvider>
      <ThreeDModeProvider>
        <AppRoutes />
      </ThreeDModeProvider>
    </AuthProvider>
  )
}

export default App