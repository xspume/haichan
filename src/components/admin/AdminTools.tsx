import { Database, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'

interface AdminToolsProps {
  loadAllData: () => Promise<void>
}

export function AdminTools({ loadAllData }: AdminToolsProps) {
  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-card text-card-foreground border-b-4 border-foreground">
        <CardTitle className="font-mono text-sm">System Tools</CardTitle>
        <CardDescription className="font-mono text-xs text-muted-foreground mt-1">
          Maintenance and diagnostic utilities
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="border-2 border-yellow-500/50 bg-yellow-500/5 p-4 flex gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
          <div className="font-mono">
            <h4 className="font-bold text-sm text-yellow-500">Danger Zone</h4>
            <p className="text-xs mt-1 text-muted-foreground">These tools can modify or delete large amounts of data. Use with caution.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => loadAllData()}
            className="font-mono border-2 border-foreground h-auto py-4"
          >
            <div className="text-left w-full">
              <div className="font-bold flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Force Data Sync
              </div>
              <div className="text-xs text-muted-foreground mt-1">Re-fetch all statistics and status from DB</div>
            </div>
          </Button>

          <Button
            variant="outline"
            disabled
            className="font-mono border-2 border-foreground h-auto py-4 opacity-50"
          >
            <div className="text-left w-full">
              <div className="font-bold flex items-center gap-2 text-destructive">
                <Database className="w-4 h-4" />
                Flush Expired Content
              </div>
              <div className="text-xs text-muted-foreground mt-1">Permenantly delete threads marked as expired</div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
