import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { handleOrbCallback } from '../lib/orb-auth'

export function OrbCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [message, setMessage] = useState('Finishing Orb sign-in...')

  const params = useMemo(() => new URLSearchParams(window.location.search), [])

  useEffect(() => {
    async function completeLogin() {
      const code = params.get('code')
      const error = params.get('error')

      if (error) {
        setStatus('error')
        setMessage(`Orb authorization failed: ${error}`)
        return
      }

      if (!code) {
        setStatus('error')
        setMessage('Orb authorization code was not returned.')
        return
      }

      try {
        await handleOrbCallback(code)
        setStatus('success')
        setMessage('Orb authorization received. Continue sign-in from the auth page.')
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Failed to complete Orb callback.')
      }
    }

    completeLogin()
  }, [params])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-lg border-2 border-primary bg-card p-6 shadow-3d-sm">
        <h1 className="text-xl font-black uppercase tracking-tight mb-3">Orb Callback</h1>
        <p className="text-sm font-medium mb-4">{message}</p>

        <div className="flex gap-2">
          <Button onClick={() => navigate('/auth')} className="font-black uppercase text-[10px] tracking-widest">
            Back to Auth
          </Button>
          {status === 'success' && (
            <Button variant="outline" onClick={() => navigate('/')} className="font-black uppercase text-[10px] tracking-widest">
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
