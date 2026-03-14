import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

/**
 * Orb currently returns auth results to this route.
 * We forward users back to /auth while preserving callback params
 * so the auth flow can be completed there without a hard 404.
 */
export function OrbCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      toast.error(`Orb login failed: ${error}`)
      navigate('/auth', { replace: true })
      return
    }

    const nextSearch = new URLSearchParams()
    if (code) nextSearch.set('orbCode', code)
    if (state) nextSearch.set('orbState', state)

    navigate(`/auth${nextSearch.toString() ? `?${nextSearch.toString()}` : ''}`, { replace: true })
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-mono">
      <div className="text-center">
        <div className="text-2xl mb-2 animate-pulse">ORB CALLBACK</div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">Redirecting to auth…</div>
      </div>
    </div>
  )
}
