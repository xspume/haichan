import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Pickaxe } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import db from '../lib/db-client'

export function WorkLedgerPage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLedger() {
      try {
        if (!dbUser) return

        const ledger = await db.db.powLedger?.list?.({
          where: { userId: dbUser.id },
          limit: 100
        }) || []
        setEntries(ledger)
      } catch (error) {
        console.error('Failed to load ledger:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLedger()
  }, [dbUser])

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3">
            <FileText className="w-6 h-6" />
            WORK LEDGER
          </h1>
          <p className="text-muted-foreground font-mono mt-2">
            Your proof-of-work history and contributions.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
            <Pickaxe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-mono">No work recorded yet. Start mining!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div key={entry.id || index} className="border-2 border-muted p-4 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown'}
                  </span>
                  <span className="font-bold text-green-500">+{entry.points || 0} pts</span>
                </div>
                {entry.hash && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {entry.hash}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
