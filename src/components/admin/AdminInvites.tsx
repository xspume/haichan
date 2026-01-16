import { Key, Trash2, Copy, Check, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

interface AdminInvitesProps {
  unusedCodes: any[]
  usedCodes: any[]
  generating: boolean
  currentEpoch: number
  username?: string
  handleGenerateCodes: () => Promise<void>
  copyToClipboard: (code: string) => Promise<void>
  setDeleteDialog: (dialog: any) => void
}

export function AdminInvites({
  unusedCodes,
  usedCodes,
  generating,
  currentEpoch,
  username,
  handleGenerateCodes,
  copyToClipboard,
  setDeleteDialog
}: AdminInvitesProps) {
  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-card text-card-foreground border-b-4 border-foreground">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-mono text-sm">INVITE CODE MANAGEMENT</CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground mt-1">
              Current Epoch: <span className="font-bold text-foreground">#{currentEpoch}</span> • Admin codes refresh every epoch
            </CardDescription>
          </div>
          <Button
            onClick={handleGenerateCodes}
            disabled={generating || username !== 'jcb'}
            className="bg-foreground text-background hover:bg-muted font-mono"
          >
            {generating ? 'GENERATING...' : 'GENERATE EPOCH CODES'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-green-500">
              <Zap className="w-4 h-4" />
              AVAILABLE CODES ({unusedCodes.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {unusedCodes.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted font-mono text-muted-foreground text-xs">
                  No codes available. Generate new ones for this epoch.
                </div>
              ) : (
                unusedCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-muted/30">
                    <code className="font-mono font-bold text-sm select-all">{code.code}</code>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(code.code)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, type: 'invite', id: code.id, name: code.code })}
                        className="h-8 w-8 text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4" />
              USED CODES ({usedCodes.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {usedCodes.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted font-mono text-muted-foreground text-xs">
                  No used codes yet.
                </div>
              ) : (
                usedCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-3 border-2 border-muted bg-muted/10 opacity-60">
                    <div>
                      <code className="font-mono text-sm line-through text-muted-foreground">{code.code}</code>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        Used by: {code.usedBy || 'Unknown'}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">USED</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
