import { Layout, Trash2, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { useNavigate } from 'react-router-dom'

interface AdminBoardsProps {
  boards: any[]
  setDeleteDialog: (dialog: any) => void
}

export function AdminBoards({ boards, setDeleteDialog }: AdminBoardsProps) {
  const navigate = useNavigate()

  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-card text-card-foreground border-b-4 border-foreground">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-mono text-sm">Board Management</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground mt-1">
              Create and manage discussion boards
            </CardDescription>
          </div>
          <Button
            onClick={() => navigate('/create-board')}
            className="bg-foreground text-background hover:bg-muted font-mono"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Board
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boards.map((board) => (
            <div key={board.id} className="flex items-center justify-between p-4 border-2 border-foreground bg-muted/30">
              <div>
                <h4 className="font-mono font-bold text-sm">/{board.slug}/ - {board.name}</h4>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 line-clamp-1">{board.description}</p>
                <div className="flex items-center gap-4 mt-2 font-mono text-[10px] text-muted-foreground">
                  <span>PoW: {board.totalPow?.toLocaleString() || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteDialog({ open: true, type: 'board', id: board.id, name: board.name })}
                  className="h-8 w-8 text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
