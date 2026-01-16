import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, User, FileText } from 'lucide-react'
import { Button } from '../components/ui/button'
import { publicDb } from '../lib/db-client'

export function UserBlogPage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserBlog() {
      try {
        if (!username) return

        // Find user by username
        const users = await publicDb.db.users.list({
          where: { username },
          limit: 1
        })

        if (users && users.length > 0) {
          setUser(users[0])

          // Load their blog posts
          const userPosts = await publicDb.db.blogPosts.list({
            where: { authorId: users[0].id, published: true },
            limit: 50
          })
          setPosts(userPosts || [])
        }
      } catch (error) {
        console.error('Failed to load user blog:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserBlog()
  }, [username])

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">USER NOT FOUND</div>
          <Button onClick={() => navigate('/blogs')} variant="outline">
            VIEW ALL BLOGS
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate('/blogs')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BLOGS
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border-2 border-foreground flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono">{user.blogName || `${username}'s Blog`}</h1>
              {user.blogDescription && (
                <p className="text-muted-foreground mt-1">{user.blogDescription}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono mt-2">@{username}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground font-mono">No blog posts yet.</p>
            </div>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.id}`}
                className="block border-2 border-foreground hover:bg-muted p-4 transition-colors"
              >
                <h3 className="font-bold font-mono">{post.title}</h3>
                {post.content && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2 font-mono">
                  {new Date(post.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
