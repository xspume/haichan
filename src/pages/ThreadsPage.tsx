import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, MessageSquare, LayoutGrid, List as ListIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { publicDb } from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import { BoardCatalog } from '../components/views/BoardCatalog'

export function ThreadsPage() {
  const { boardSlug } = useParams<{ boardSlug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [board, setBoard] = useState<any>(null)
  const [threads, setThreads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'catalog'>('list')

  useEffect(() => {
    async function loadBoard() {
      try {
        const boards = await publicDb.db.boards.list({
          where: { slug: boardSlug },
          limit: 1
        })

        if (boards && boards.length > 0) {
          setBoard(boards[0])

          const boardThreads = await publicDb.db.threads.list({
            where: { boardId: boards[0].id },
            orderBy: { bumpOrder: 'desc' },
            limit: 50
          })
          setThreads(boardThreads || [])
        }
      } catch (error) {
        console.error('Failed to load board:', error)
      } finally {
        setLoading(false)
      }
    }

    if (boardSlug) {
      loadBoard()
    }
  }, [boardSlug])

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING</div>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">BOARD NOT FOUND</div>
          <Button onClick={() => navigate('/boards')} variant="outline">
            View All Boards
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate('/boards')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Boards
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-mono">/{board.slug}/ - {board.name}</h1>
              {board.description && (
                <p className="text-sm text-muted-foreground mt-1">{board.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border-2 border-foreground overflow-hidden mr-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                  title="List View"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('catalog')}
                  className={`p-1.5 transition-colors ${viewMode === 'catalog' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
                  title="Catalog View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              {isAuthenticated && (
                <Button
                  onClick={() => navigate(`/board/${boardSlug}/new`)}
                  className="font-mono"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Thread
                </Button>
              )}
            </div>
          </div>
        </div>

        {viewMode === 'catalog' ? (
          <BoardCatalog threads={threads} boardSlug={boardSlug || ''} />
        ) : (
          <div className="space-y-4">
            {threads.length === 0 ? (
              <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground font-mono">No threads yet. Be the first to post!</p>
              </div>
            ) : (
              threads.map((thread) => (
                <Link
                  key={thread.id}
                  to={`/board/${boardSlug}/thread/${thread.id}`}
                  className="flex gap-4 border-2 border-foreground hover:bg-muted p-4 transition-colors group"
                >
                  {thread.imageUrl && (
                    <div className="w-24 h-24 shrink-0 border border-border overflow-hidden bg-white">
                      <img
                        src={thread.imageUrl}
                        alt={thread.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold font-mono truncate text-primary group-hover:underline">
                      {thread.title || 'Untitled Thread'}
                    </h3>
                    {thread.content && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{thread.content}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 font-mono">
                      {Number(thread.replyCount) || 0} replies
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
