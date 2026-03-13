import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * OAuth callback landing page for Orb sign-in.
 *
 * Current backend integration is not finalized, so we surface callback status,
 * preserve the auth code for later completion, and return users to /auth.
 */
export function OrbCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const error = searchParams.get('error')
    const code = searchParams.get('code')

    if (error) {
      toast.error(`Orb auth failed: ${error}`)
      navigate('/auth', { replace: true })
      return
    }

    if (!code) {
      toast.error('Missing Orb authorization code')
      navigate('/auth', { replace: true })
      return
    }

    // Store short-term for follow-up exchange flow.
    sessionStorage.setItem('orb_oauth_code', code)
    toast.success('Orb authorization received. Finish sign-in on the auth page.')
    navigate('/auth', { replace: true })
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="border-2 border-primary bg-card p-6 text-center font-mono max-w-md w-full">
        <Loader2 className="mx-auto h-6 w-6 animate-spin mb-3" />
        <p className="text-xs uppercase tracking-wider">Processing Orb authentication...</p>
      </div>
    </div>
  )
}
