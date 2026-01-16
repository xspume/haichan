import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Shield } from 'lucide-react'

interface AdminOverviewProps {
  stats: {
    totalUsers: number
    totalThreads: number
    totalPosts: number
    totalPow: number
    totalBoards: number
  }
}

export function AdminOverview({ stats }: AdminOverviewProps) {
  const navigate = useNavigate()

  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-card text-card-foreground border-b-4 border-foreground">
        <CardTitle className="font-mono text-sm">SYSTEM OVERVIEW</CardTitle>
        <CardDescription className="font-mono text-xs text-muted-foreground mt-1">
          Quick actions and system information
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => navigate('/seed')}
            variant="outline"
            className="font-mono border-2 border-foreground h-auto py-4"
          >
            <div className="text-left w-full">
              <div className="font-bold">DATABASE SEED</div>
              <div className="text-xs text-muted-foreground mt-1">Initialize test data and boards</div>
            </div>
          </Button>
          <Button
            onClick={() => navigate('/images')}
            variant="outline"
            className="font-mono border-2 border-foreground h-auto py-4"
          >
            <div className="text-left w-full">
              <div className="font-bold">IMAGE LIBRARY</div>
              <div className="text-xs text-muted-foreground mt-1">Manage uploaded images</div>
            </div>
          </Button>
        </div>

        <div className="bg-muted border-2 border-foreground p-4 font-mono text-sm">
          <p className="font-bold mb-3 text-base">📊 SYSTEM STATISTICS:</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li className="flex justify-between">
                  <span>Total Users:</span>
                  <span className="font-bold">{stats.totalUsers}</span>
                </li>
                <li className="flex justify-between">
                  <span>Total Threads:</span>
                  <span className="font-bold">{stats.totalThreads}</span>
                </li>
                <li className="flex justify-between">
                  <span>Total Posts:</span>
                  <span className="font-bold">{stats.totalPosts}</span>
                </li>
              </ul>
            </div>
            <div>
              <ul className="space-y-2 text-muted-foreground text-xs">
                <li className="flex justify-between">
                  <span>Avg PoW/User:</span>
                  <span className="font-bold">{stats.totalUsers > 0 ? Math.floor(stats.totalPow / stats.totalUsers) : 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Posts/Thread:</span>
                  <span className="font-bold">{stats.totalThreads > 0 ? (stats.totalPosts / stats.totalThreads).toFixed(1) : 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Total Boards:</span>
                  <span className="font-bold">{stats.totalBoards}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
