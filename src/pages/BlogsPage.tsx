import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { BookOpen, Plus, TrendingUp, User } from 'lucide-react'
import { useMouseoverMining } from '../hooks/use-mining'
import { publicDb } from '../lib/db-client'
import { getFontFamily } from '../lib/rich-text'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToChannel } from '../lib/realtime-manager'

function BlogCard({ blog }: { blog: any }) {
  const { useAttachTo } = useMouseoverMining('blog', blog.id)
  const elementRef = useRef<HTMLDivElement>(null)
  const fontFamily = getFontFamily(blog.themeFont || 'mono')
  const accentColor = blog.themeColor || '#000000'

  useEffect(() => {
    if (elementRef.current) {
      const cleanup = useAttachTo(elementRef.current)
      return cleanup
    }
  }, [useAttachTo])

  return (
    <Card
      ref={elementRef}
      className="border-2 hover:border-foreground transition-colors"
    >
      <CardHeader>
        {blog.blogName && (
          <div
            className="text-xs font-bold mb-2 uppercase tracking-wider"
            style={{
              fontFamily,
              color: accentColor
            }}
          >
            {blog.blogName}
          </div>
        )}
        <CardTitle
          className="text-xl mb-2"
          style={{ fontFamily }}
        >
          {blog.title}
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <User className="w-3 h-3" />
          <span>{blog.authorUsername || 'Anonymous'}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className="text-sm text-muted-foreground mb-4 line-clamp-3"
          style={{ fontFamily }}
        >
          {blog.content.substring(0, 200)}...
        </p>
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="font-bold">{blog.totalPow || 0}</span>
            <span className="text-muted-foreground">PoW</span>
          </div>
          <Link to={`/blog/${blog.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="font-mono"
              style={{
                borderColor: accentColor,
                color: accentColor
              }}
            >
              READ MORE
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function BlogsPage() {
  const [blogs, setBlogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { authState } = useAuth()

  useEffect(() => {
    loadBlogs()

    // Set up realtime subscription for live blog updates
    // Uses subscribeToChannel which handles auth checks to prevent WebSocket errors
    let unsubscribe: (() => void) | null = null

    const initRealtime = async () => {
      unsubscribe = await subscribeToChannel(
        'blogs',
        'blogs-page-updates',
        (message: any) => {
          if (message.type === 'blog_updated' || message.type === 'pow_completed') {
            // Silently refresh blogs in background
            loadBlogs()
          }
        }
      )
    }

    initRealtime()

    return () => {
      unsubscribe?.()
    }
  }, [])

  const loadBlogs = async () => {
    try {
      setError(null)
      // Fetch ALL published blogs, sorted by PoW (content is public)
      const allBlogs = await publicDb.db.blogPosts.list({
        where: { published: 1 },
        orderBy: { totalPow: 'desc' },
        limit: 100
      })
      setBlogs(allBlogs)
    } catch (error) {
      console.error('Failed to load blogs:', error)
      setError('Failed to load blogs.')
      setBlogs([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Fetching blogs</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 font-mono flex items-center gap-3">
            <BookOpen className="w-10 h-10" />
            BLOGS
          </h1>
          <p className="text-muted-foreground">
            All blog posts ranked by proof-of-work
          </p>
        </div>
        <Button
          className="font-mono"
          onClick={() => navigate('/blogs/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          NEW POST
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {error && (
          <Card className="border-2 border-destructive/40 bg-destructive/5 col-span-full">
            <CardContent className="py-6 text-center">
              <p className="font-mono text-xs text-destructive uppercase tracking-widest font-bold">{error}</p>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Try refreshing the page.</p>
            </CardContent>
          </Card>
        )}

        {blogs.map((blog) => (
          <BlogCard key={blog.id} blog={blog} />
        ))}

        {blogs.length === 0 && !error && (
          <Card className="border-2 border-dashed col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-xl font-mono mb-2">No blog posts yet</p>
              <p className="text-sm text-muted-foreground mb-4">Write the first blog post</p>
              <Button
                className="font-mono"
                onClick={() => navigate('/blogs/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                CREATE POST
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
