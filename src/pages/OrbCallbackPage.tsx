import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

export function OrbCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    const code = searchParams.get('code')

    if (error) {
      toast.error(`Orb login failed: ${error}`)
      navigate('/auth', { replace: true })
      return
    }

    if (!code) {
      toast.error('Orb login failed: missing authorization code')
      navigate('/auth', { replace: true })
      return
    }

    // Orb OAuth code exchange is not fully wired yet in this frontend-only flow.
    // Preserve momentum by returning user to auth with a clear status message.
    toast('Orb callback received. Complete token exchange wiring to finish sign-in.')
    navigate('/auth', { replace: true })
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center font-mono">
        <div className="text-2xl mb-2 animate-pulse">ORB CALLBACK</div>
        <div className="text-sm text-muted-foreground">Redirecting…</div>
      </div>
    </div>
  )
}
