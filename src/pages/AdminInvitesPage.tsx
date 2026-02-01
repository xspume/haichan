import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Copy, Check, Key, Plus, Users, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import { getUserInviteCodes, grantEpochInviteCodes, getCurrentEpoch } from '../lib/invite-codes'
import { ADMIN_CODES_PER_EPOCH } from '../lib/constants'

export function AdminInvitesPage() {
  const { authState } = useAuth()
  const [inviteCodes, setInviteCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentEpoch, setCurrentEpoch] = useState<number>(256)
  const [generating, setGenerating] = useState(false)
  const [isJcb, setIsJcb] = useState(false)

  useEffect(() => {
    loadData()
  }, [authState.user?.id])

  const loadData = async () => {
    try {
      if (!authState.user?.id) {
        setLoading(false)
        return
      }
      
      // Check if the current user is jcb (the only user who can generate codes)
      const userIsJcb = authState.user?.username === 'jcb'
      setIsJcb(userIsJcb)
      
      const epoch = await getCurrentEpoch()
      setCurrentEpoch(epoch)
      
      const codes = await getUserInviteCodes(authState.user.id)
      setInviteCodes(codes)
    } catch (error) {
      console.error('Failed to load invite codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCodes = async () => {
    if (!authState.user?.id) return
    
    // Only jcb can generate codes
    if (authState.user?.username !== 'jcb') {
      toast.error('Only the admin user "jcb" can generate invite codes')
      return
    }
    
    setGenerating(true)
    try {
      const isAdmin = Number(authState.user?.isAdmin) > 0
      await grantEpochInviteCodes(authState.user.id, isAdmin)
      toast.success(`Generated ${isAdmin ? ADMIN_CODES_PER_EPOCH : 1} new invite code(s)!`)
      await loadData()
    } catch (error) {
      toast.error('Failed to generate invite codes')
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  // Filter codes: unused = has remaining uses, used = fully exhausted
  const unusedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount < maxUses
  })
  const usedCodes = inviteCodes.filter(code => {
    const maxUses = Number(code.maxUses) || 1
    const usesCount = Number(code.usesCount) || 0
    return usesCount >= maxUses
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Loading invite codes</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen font-sans">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="border-4 border-primary bg-card text-card-foreground p-3 mb-4 shadow-3d-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">INVITE CODES</h1>
              <p className="text-[10px] font-bold mt-1 opacity-70 uppercase tracking-widest">
                Epoch-based invite system • {authState.user?.isAdmin ? 'Admin' : 'User'} • Current epoch: {currentEpoch}
              </p>
            </div>
            {isJcb && (
              <Button
                onClick={handleGenerateCodes}
                disabled={generating}
                className="font-sans font-black uppercase text-[10px]"
              >
                <Plus className="w-3 h-3 mr-2" />
                {generating ? 'GENERATING...' : 'GENERATE CODES'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-2 border-primary bg-background shadow-3d-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <Key className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-black">{unusedCodes.length}</p>
                <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">UNUSED CODES</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary bg-background shadow-3d-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-black">{usedCodes.length}</p>
                <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">USED CODES</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary bg-background shadow-3d-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <Check className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-black">{inviteCodes.length}</p>
                <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">TOTAL CODES</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Box */}
        <Card className="border-2 border-border/40 mb-6 bg-card/30">
          <CardContent className="pt-6">
            <div className="border-l-4 border-primary pl-4 py-2">
              <p className="text-[10px] text-primary font-black mb-2 uppercase tracking-widest">📋 INVITE CODE SYSTEM</p>
              <ul className="text-[11px] space-y-1 text-muted-foreground font-medium">
                <li>• Only the admin user "jcb" can generate invite codes</li>
                <li>• Admin generates {ADMIN_CODES_PER_EPOCH} invite codes per batch</li>
                <li>• Codes can have multiple uses (default: 1 use per code)</li>
                <li>• All generated codes appear in the list below</li>
                {!isJcb && <li className="text-destructive font-bold uppercase">⚠️ You do not have permission to generate codes</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Unused Codes */}
        {unusedCodes.length > 0 && (
          <Card className="border-2 border-primary mb-6 shadow-3d-sm">
            <CardHeader className="border-b border-primary/20 bg-primary/5">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                <Key className="w-3 h-3" />
                AVAILABLE INVITE CODES ({unusedCodes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {unusedCodes.map((code) => {
                  const maxUses = Number(code.maxUses) || 1
                  const usesCount = Number(code.usesCount) || 0
                  const remainingUses = maxUses - usesCount
                  
                  return (
                    <div key={code.id} className="flex items-center gap-2 p-3 bg-muted/20 border-2 border-dashed border-border/40">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-mono font-black select-all text-primary">{code.code}</p>
                          {maxUses > 1 && (
                            <span className="text-[9px] font-black bg-primary/20 text-primary px-2 py-0.5 border border-primary/20 uppercase">
                              {remainingUses}/{maxUses} USES
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">
                          Created: {new Date(code.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => copyToClipboard(code.code)}
                        variant="outline"
                        size="sm"
                        className="text-[10px] font-black uppercase px-4 h-7"
                      >
                        <Copy className="w-3 h-3 mr-2" />
                        COPY
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Used Codes */}
        {usedCodes.length > 0 && (
          <Card className="border-2 border-foreground">
            <CardHeader className="border-b-2 border-foreground bg-card text-card-foreground">
              <CardTitle className="font-mono text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                USED INVITE CODES ({usedCodes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {usedCodes.map((code) => {
                  const maxUses = Number(code.maxUses) || 1
                  const usesCount = Number(code.usesCount) || 0
                  
                  return (
                    <div key={code.id} className="p-3 bg-muted rounded border-2 opacity-60">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-mono font-bold line-through">{code.code}</p>
                          {maxUses > 1 && (
                            <span className="text-xs font-mono bg-gray-600 text-white px-2 py-1 rounded">
                              {usesCount}/{maxUses} USED
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">FULLY USED</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground space-y-1">
                        <p>Created: {new Date(code.createdAt).toLocaleString()}</p>
                        {code.usedAt && <p>Last used: {new Date(code.usedAt).toLocaleString()}</p>}
                        {code.usedBy && <p>Last used by: {code.usedBy}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {inviteCodes.length === 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <Key className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-mono mb-2">No invite codes yet</p>
              <p className="text-sm text-muted-foreground mb-6 font-mono">
                {isJcb ? 'Generate your first batch of invite codes' : 'Only admin user "jcb" can generate codes'}
              </p>
              {isJcb && (
                <Button
                  onClick={handleGenerateCodes}
                  disabled={generating}
                  className="font-mono"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {generating ? 'GENERATING...' : 'GENERATE CODES'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
