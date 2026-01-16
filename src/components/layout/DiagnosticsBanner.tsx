import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PROJECT_ID } from '../../lib/db-client'

export function DiagnosticsBanner() {
  const missingProjectId = useMemo(() => !PROJECT_ID, [])

  if (!missingProjectId) return null

  return (
    <div className="border-b border-destructive/40 bg-destructive/10 text-destructive">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-start gap-2 font-mono">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="text-[10px] leading-relaxed uppercase tracking-widest">
          <div className="font-black">ENV MISCONFIGURED: VITE_BLINK_PROJECT_ID IS MISSING</div>
          <div className="opacity-80">
            Data reads will fail, which can look like a blank site. Add it to your environment/secrets and reload.
          </div>
        </div>
      </div>
    </div>
  )
}
