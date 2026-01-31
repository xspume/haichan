import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { LogIn, UserPlus, Key, Download } from 'lucide-react'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { generateBitcoinKeypair, getBitcoinAddressType } from '../lib/bitcoin'
import { downloadFullCredentialBackup } from '../lib/backup'
import { generateSalt, hashPrivateKey } from '../lib/crypto'
import { validateInviteCode, markInviteCodeAsUsed, getCurrentEpoch } from '../lib/invite-codes'
import { validateUsername, sanitizeUsername } from '../lib/username-validation'
import { MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH } from '../lib/constants'
import { getCurrentPublicInviteCode, isPublicInviteActive, getTimeRemaining, getPublicInviteMessage } from '../lib/public-invite-codes'
import { useAuth } from '../contexts/AuthContext'

export function AuthPage() {
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { siteSettings } = useAuth()
  const [showAdminSeed, setShowAdminSeed] = useState(false)
  const [currentEpoch, setCurrentEpoch] = useState<number>(256)

  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [resolvedEmail, setResolvedEmail] = useState('')
  const [useBitcoinAuth, setUseBitcoinAuth] = useState(false)
  const [privateKeyInput, setPrivateKeyInput] = useState('')

  // Register state
  const [registerUsername, setRegisterUsername] = useState('')
  const [email, setEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedKeys, setGeneratedKeys] = useState<{ privateKey: string; publicKey: string; address: string } | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [hasDownloadedKey, setHasDownloadedKey] = useState(false)
  const [registerUsernameError, setRegisterUsernameError] = useState('')
  const [inviteCodeError, setInviteCodeError] = useState('')
  const [publicInviteMessage, setPublicInviteMessage] = useState<string | null>(null)
  
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    checkForAdminUser()
    loadCurrentEpoch()
    updatePublicInviteMessage()

    // Best-effort ensure public invite codes exist in DB for smoother onboarding
    ;(async () => {
      try {
        const { initializePublicInviteCodes } = await import('../lib/public-invite-codes')
        await initializePublicInviteCodes()
      } catch {
        // ignore
      }
    })()
    
    // Auto-fill public invite code if available
    const publicCode = getCurrentPublicInviteCode()
    if (publicCode && !inviteCode) {
      setInviteCode(publicCode)
    }
    
    // Update public invite message every minute
    const interval = setInterval(updatePublicInviteMessage, 60000)
    return () => clearInterval(interval)
  }, [])

  const checkForAdminUser = async () => {
    try {
      const count = await db.db.users.count({ where: { isAdmin: '1' } })
      setShowAdminSeed(count === 0)
    } catch (error: any) {
      // Silently fail for expected errors - default to not showing admin seed
      const errorMessage = error?.message || ''
      const errorCode = error?.code || ''
      const errorStatus = error?.status ?? -1
      
      // Silent failure cases:
      // - Rate limited
      // - Network errors (status 0 = no connection, aborted, or CORS)
      // - BlinkNetworkError
      if (
        errorMessage.includes('Rate limit') ||
        errorStatus === 0 ||
        errorCode === 'NETWORK_ERROR' ||
        errorMessage.includes('Load failed') ||
        errorMessage.includes('Network request failed')
      ) {
        console.debug('Admin check skipped due to network/rate limit')
      } else {
        console.error('Failed to check for admin:', error)
      }
      setShowAdminSeed(false)
    }
  }

  const loadCurrentEpoch = async () => {
    try {
      const epoch = await getCurrentEpoch()
      setCurrentEpoch(epoch)
    } catch (error: any) {
      // Silently fail for expected errors - use default
      const errorMessage = error?.message || ''
      const errorCode = error?.code || ''
      const errorStatus = error?.status ?? -1
      
      if (
        errorMessage.includes('Rate limit') ||
        errorStatus === 0 ||
        errorCode === 'NETWORK_ERROR' ||
        errorMessage.includes('Load failed') ||
        errorMessage.includes('Network request failed')
      ) {
        console.debug('Epoch check skipped due to network/rate limit')
      } else {
        console.error('Failed to load epoch:', error)
      }
    }
  }

  const updatePublicInviteMessage = () => {
    const message = getPublicInviteMessage()
    setPublicInviteMessage(message)
  }

  // Login handlers
  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    
    setLoading(true)
    setUsernameError('')
    setResolvedEmail('')

    try {
      let loginEmail = ''
      let loginPassword = password
      
      if (useBitcoinAuth) {
        // Private Key Login Flow
        const { isValidWIF, deriveAddressFromWIF } = await import('../lib/bitcoin')
        const { sha256 } = await import('../lib/crypto')
        
        if (!isValidWIF(privateKeyInput)) {
          setUsernameError('Invalid Private Key (WIF format required)')
          setLoading(false)
          return
        }
        
        const address = deriveAddressFromWIF(privateKeyInput)
        console.log('[AuthPage] Derived address from private key:', address)
        
        // Lookup user by address
        const { invokeFunction } = await import('../lib/functions-utils')
        const result = await invokeFunction('get-user-by-username', { body: { username: address } })
        
        // Check for errors first
        if (result.error) {
          const errorMsg = result.error?.error || result.error?.message || 'Address lookup failed'
          console.log('[AuthPage] Bitcoin address lookup error:', errorMsg)
          setUsernameError('No account found for this Bitcoin address. Have you registered?')
          setLoading(false)
          return
        }
        
        if (result.data && result.data.user && result.data.user.email) {
          loginEmail = result.data.user.email
          setResolvedEmail(loginEmail)
          
          // CRITICAL FIX: Derive login password from private key using the stored salt
          const userMetadata = result.data.user.metadata || {}
          const salt = userMetadata.keySalt || ''
          
          if (!salt) {
            console.warn('[AuthPage] No salt found for Bitcoin user - this may be an old account')
            // Fallback to password or show error
            setUsernameError('Account found but secure key authentication is not configured. Use password login.')
            setLoading(false)
            return
          }
          
          loginPassword = await sha256(privateKeyInput + salt)
          console.log('[AuthPage] Derived deterministic password from private key')
        } else {
          setUsernameError('No account found for this Bitcoin address. Have you registered?')
          setLoading(false)
          return
        }
      } else {
        // Standard Username/Email Login Flow
        const input = username.trim()
        const isEmailInput = input.includes('@')
        loginEmail = input

        if (!isEmailInput) {
          console.log('[AuthPage] Looking up email for username:', input)
          const { invokeFunction } = await import('../lib/functions-utils')
          const result = await invokeFunction('get-user-by-username', { body: { username: input } })
          
          // Check for errors first
          if (result.error) {
            const errorMsg = result.error?.error || result.error?.message || 'User lookup failed'
            console.log('[AuthPage] Username lookup error:', errorMsg)
            setUsernameError(errorMsg.includes('not found') ? 'User not found. Check your username or try registering.' : `Lookup failed: ${errorMsg}`)
            setLoading(false)
            return
          }
          
          if (result.data && result.data.user && result.data.user.email) {
            loginEmail = result.data.user.email
            setResolvedEmail(loginEmail)
          } else {
            setUsernameError('User not found. Check your username or register a new account.')
            setLoading(false)
            return
          }
        }
      }

      console.log('[AuthPage] Final login attempt with email:', loginEmail)
      await db.auth.signInWithEmail(loginEmail, loginPassword)

      // Wait for auth state to propagate before navigating
      // This ensures MainLayout will see the authenticated state
      console.log('[AuthPage] Waiting for auth state to propagate...')
      let authReady = false
      for (let i = 0; i < 20; i++) {
        // Check if auth is now authenticated
        if (db.auth.isAuthenticated()) {
          authReady = true
          break
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (!authReady) {
        console.warn('[AuthPage] Auth state did not propagate within timeout, navigating anyway')
      } else {
        console.log('[AuthPage] Auth state confirmed, proceeding with navigation')
      }

      // We don't want to block navigation for backup generation
      // This part is a non-critical enhancement
      const generateBackup = async () => {
        try {
          let targetUser = await db.auth.me()
          if (targetUser) {
            // Use publicDb or a timeout to avoid blocking if the main db client is busy
            const users = await Promise.race([
              db.db.users.list({ where: { id: targetUser.id }, limit: 1 }),
              new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]).catch(() => [])

            if (users && users.length > 0) {
              targetUser = { ...targetUser, ...users[0] }
            }
          }

          const isFirstLogin = targetUser ? (!targetUser.lastSignIn || new Date(targetUser.lastSignIn).getTime() === new Date(targetUser.createdAt).getTime()) : false

          if (isFirstLogin && targetUser) {
            const inviteCodes = await db.db.inviteCodes.list({ where: { usedBy: targetUser.id }, limit: 1 }).catch(() => [])
            const inviteCodeValue = inviteCodes && inviteCodes.length > 0 ? inviteCodes[0].code : 'N/A'

            downloadFullCredentialBackup({
              username: targetUser.username || username,
              email: targetUser.email,
              password,
              userId: targetUser.id,
              bitcoinAddress: targetUser.bitcoinAddress || 'N/A',
              publicKey: targetUser.publicKey,
              registrationDate: targetUser.createdAt,
              inviteCode: inviteCodeValue,
              totalPowPoints: targetUser.totalPowPoints || 0,
              diamondLevel: targetUser.diamondLevel || 0,
              backupGeneratedAt: new Date().toISOString(),
              isFirstLogin: true
            })

            toast.success('First login! Credential backup downloaded.', { duration: 5000 })
          }
        } catch (backupError) {
          console.error('[AuthPage] Failed to generate first login backup:', backupError)
        }
      }

      // Start backup process but don't await it
      generateBackup()

      toast.success('Welcome back!')
      console.log('[AuthPage] Navigating to home after successful login')
      
      if (isMounted.current) {
        navigate('/')
      }
    } catch (error: any) {
      console.error('[AuthPage] Login error:', error)
      const errorCode = error?.code || ''
      const errorMessage = error?.userMessage || error?.message || 'Login failed'

      // Check error code first (more reliable), then fall back to message parsing
      if (errorCode === 'INVALID_CREDENTIALS' || errorCode === 'UNAUTHORIZED') {
        setUsernameError('Invalid username or password. If you forgot your password, you may need to register a new account or contact an admin.')
        toast.error('Invalid username or password')
      } else if (errorCode === 'RATE_LIMITED' || errorCode === 'RATE_LIMIT_EXCEEDED' || errorMessage.includes('Rate limit')) {
        setUsernameError('Too many login attempts. Please wait a few minutes and try again.')
        toast.error('Rate limited. Please wait.')
      } else if (errorCode === 'NETWORK_ERROR' || error?.status === 0) {
        setUsernameError('Network error. Please check your connection and try again.')
        toast.error('Network error. Please try again.')
      } else if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('unauthorized')) {
        // Fallback for message-based detection
        setUsernameError('Invalid username or password. If you forgot your password, you may need to register a new account or contact an admin.')
        toast.error('Invalid username or password')
      } else {
        setUsernameError(`SYSTEM_ERROR: ${errorMessage}`)
        toast.error(errorMessage)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }



  // Register handlers
  const handleRegisterUsernameChange = async (value: string) => {
    const sanitized = sanitizeUsername(value)
    setRegisterUsername(sanitized)
    setRegisterUsernameError('')

    if (sanitized.length >= MIN_USERNAME_LENGTH) {
      const validation = await validateUsername(sanitized)
      if (!validation.valid) {
        setRegisterUsernameError(validation.message)
      }
    }
  }

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase())
    setInviteCodeError('')
  }

  const handleGenerateKeys = () => {
    try {
      const keys = generateBitcoinKeypair()
      if (!keys) {
        toast.error('Bitcoin crypto unavailable in this browser. Please use password authentication.')
        return
      }
      setGeneratedKeys(keys)
      setHasDownloadedKey(false)
      toast.success('Bitcoin keypair generated! Please download and secure your private key.')
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate Bitcoin keypair')
      console.error('Keypair generation error:', error)
    }
  }

  const handleDownloadPrivateKey = () => {
    if (!generatedKeys) return

    const content = `HAICHAN BITCOIN PRIVATE KEY
=====================================

⚠️ CRITICAL: Store this file securely offline!
Your private key provides backup access to your account.
Anyone with this key can authenticate as you.

Username: ${registerUsername || 'Not set'}
Bitcoin Address: ${generatedKeys.address}
Address Type: ${getBitcoinAddressType(generatedKeys.address)}

Private Key (WIF Format):
${generatedKeys.privateKey}

Public Key (hex):
${generatedKeys.publicKey}

Generated: ${new Date().toISOString()}

🔒 SECURITY NOTES:
- Never share this key with anyone
- Store in a password manager or encrypted drive
- Consider printing and storing in a safe
- This key is NEVER stored on Haichan servers
- Use this key for backup authentication only
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `haichan-bitcoin-key-${generatedKeys.address.slice(0, 8)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setHasDownloadedKey(true)
    toast.success('Private key downloaded! Keep this file secure.')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (loading) return
    setLoading(true)

    try {
      // 1. Validate inputs
      if (!registerUsername || !email || !registerPassword) {
        toast.error('All fields are mandatory (Username, Email, Password)')
        setLoading(false)
        return
      }

      const usernameValidation = await validateUsername(registerUsername)
      if (!usernameValidation.valid) {
        setRegisterUsernameError(usernameValidation.message)
        toast.error(usernameValidation.message)
        setLoading(false)
        return
      }

      const isInviteRequired = siteSettings?.isInviteOnly !== false
      let inviteValidation: { valid: boolean; message: string; codeId?: string } = { valid: true, message: '' }

      if (isInviteRequired) {
        inviteValidation = await validateInviteCode(inviteCode)
        if (!inviteValidation.valid) {
          setInviteCodeError(inviteValidation.message)
          toast.error(inviteValidation.message)
          setLoading(false)
          return
        }
      }

      // 2. Validate Bitcoin keys
      if (!generatedKeys || !hasDownloadedKey) {
        toast.error('Please generate and download your Bitcoin private key first')
        setLoading(false)
        return
      }

      const { invokeFunction } = await import('../lib/functions-utils')
      const existingUserCheck = await invokeFunction('get-user-by-username', { body: { username: generatedKeys.address } })
      if (existingUserCheck.data && existingUserCheck.data.user) {
        toast.error('This Bitcoin address is already registered')
        setLoading(false)
        return
      }

      // 3. Prepare Bitcoin auth data
      const { sha256 } = await import('../lib/crypto')
      const salt = generateSalt()
      const keyHash = await hashPrivateKey(generatedKeys.privateKey, salt)
      
      // CRITICAL FIX: Use deterministic hash of private key as Blink password for Bitcoin registration
      const blinkPassword = await sha256(generatedKeys.privateKey + salt)

      // 4. Create Auth User
      let user: any = null
      try {
        user = await db.auth.signUp({
          email,
          password: blinkPassword,
          displayName: registerUsername,
          metadata: {
            username: registerUsername,
            bitcoinAddress: generatedKeys.address,
            addressType: getBitcoinAddressType(generatedKeys.address),
            publicKey: generatedKeys.publicKey,
            keySalt: salt,
            keyHash: keyHash
          }
        })

        // Auto-login after signup
        console.log('[AuthPage] Signup successful, auto-logging in...')
        await db.auth.signInWithEmail(email, blinkPassword)
        console.log('[AuthPage] Auto-login successful')

      } catch (signupError: any) {
        const errorMsg = signupError.message || 'Signup failed'
        console.error('Signup auth error:', signupError)
        
        if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('exists')) {
          toast.error('This email is already registered. Please try logging in instead.')
        } else {
          toast.error(`Signup failed: ${errorMsg}`)
        }
        setLoading(false)
        return
      }

      if (user?.id) {
        // 5. Sync User Profile to Database
        // We attempt to sync the user profile, but we don't want to block the user forever
        const syncProfile = async () => {
          try {
            // Wait for auth session to be fully ready in the SDK instance
            console.log('[AuthPage] Waiting for auth session to be ready...')
            
            let authenticatedUser = null;
            for (let i = 0; i < 10; i++) { // reduced attempts
              authenticatedUser = await db.auth.me();
              if (authenticatedUser && authenticatedUser.id === user.id) {
                console.log('[AuthPage] Auth session verified for user:', authenticatedUser.id)
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 250));
            }

            const nowIso = new Date().toISOString()
            const userData: any = {
              id: user.id,
              userId: user.id,
              username: registerUsername.toLowerCase(),
              email,
              createdAt: nowIso,
              updatedAt: nowIso,
              totalPowPoints: 0,
              diamondLevel: 0,
              isAdmin: 0,
              emailVerified: 0,
              lastSignIn: nowIso,
              bitcoinAddress: generatedKeys.address,
              publicKey: generatedKeys.publicKey
            }

            let profileCreated = false
            // Retry logic for profile creation
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await db.db.users.upsert(userData)
                console.log('User record synced successfully:', user.id)
                profileCreated = true
                break
              } catch (error: any) {
                console.error(`Failed to sync user record (attempt ${attempt + 1}/3):`, error)
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 1000))
                }
              }
            }

            // Handle Invite Code
            if (inviteValidation.codeId) {
              try {
                await markInviteCodeAsUsed(inviteValidation.codeId, user.id)
              } catch (e) {
                console.warn('Failed to mark invite code as used:', e)
              }
            }
          } catch (e) {
            console.error('[AuthPage] Profile sync background task failed:', e)
          }
        }

        // Start sync process but don't await the whole thing if it takes too long
        // However, we SHOULD wait for the first successful upsert if possible for consistency
        // But for "stuck" issue, let's make it more resilient
        await syncProfile()

        // 7. Download Backup
        try {
          downloadFullCredentialBackup({
            username: registerUsername,
            email,
            password: registerPassword,
            userId: user.id,
            bitcoinAddress: generatedKeys?.address || 'N/A',
            publicKey: generatedKeys?.publicKey || '',
            privateKey: generatedKeys?.privateKey || '',
            registrationDate: new Date().toISOString(),
            inviteCode,
            totalPowPoints: 0,
            diamondLevel: 0,
            backupGeneratedAt: new Date().toISOString(),
            isFirstLogin: false
          })
        } catch (e) {
          console.warn('Failed to download credential backup:', e)
        }

        // 8. Wait for auth state to fully propagate
        console.log('[AuthPage] Registration complete, waiting for auth state to propagate...')
        let authReady = false
        for (let i = 0; i < 20; i++) {
          if (db.auth.isAuthenticated()) {
            authReady = true
            break
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        if (!authReady) {
          console.warn('[AuthPage] Auth state did not propagate within timeout, navigating anyway')
        } else {
          console.log('[AuthPage] Auth state confirmed, proceeding with navigation')
        }

        // 9. Show Success Message & Navigate
        toast.dismiss()
        toast.success('Registration successful! Credential backup downloaded.', { duration: 5000 })

        if (isMounted.current) {
          navigate('/')
        }
      } else {
        toast.error('Signup failed: No user ID returned')
      }
    } catch (error: any) {
      console.error('Unexpected registration error:', error)
      toast.error(error.message || 'Registration failed. Please try again.')
    } finally {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 font-mono">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold tracking-tighter haichan-logo">HAICHAN</h1>
          <p className="text-xs text-primary/60 uppercase tracking-wider">Human Consensus Experiment</p>
        </div>

        <div className="card-3d p-1 bg-primary">
          <div className="bg-background p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8 bg-primary/10 p-1 rounded-none border border-primary/30">
                <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-background text-[10px] uppercase font-bold">
                  <LogIn className="w-3 h-3 mr-2" />
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-background text-[10px] uppercase font-bold">
                  <UserPlus className="w-3 h-3 mr-2" />
                  Join
                </TabsTrigger>
                <TabsTrigger value="lurk" className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-background text-[10px] uppercase font-bold">
                  👻 Lurk
                </TabsTrigger>
              </TabsList>

              {/* LOGIN TAB */}
              <TabsContent value="login" className="animate-in fade-in duration-300">
                <form onSubmit={handleUsernameLogin} className="space-y-6">
                  {usernameError && (
                    <div className="p-3 bg-red-950/30 border border-red-500/50 text-red-500 text-[10px] font-bold uppercase tracking-wider">
                      Error: {usernameError}
                    </div>
                  )}

                  {resolvedEmail && (
                    <div className="p-2 bg-primary/10 border border-primary/30 text-primary/70 text-[9px] font-mono">
                      Account: {resolvedEmail.slice(0, 3)}...{resolvedEmail.split('@')[1]}
                    </div>
                  )}

                  <div className="flex items-center space-x-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setUseBitcoinAuth(false)}
                      className={`flex-1 py-1 text-[10px] uppercase font-bold border ${!useBitcoinAuth ? 'bg-primary text-background border-primary' : 'bg-transparent text-primary/50 border-primary/30'}`}
                    >
                      Username
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseBitcoinAuth(true)}
                      className={`flex-1 py-1 text-[10px] uppercase font-bold border ${useBitcoinAuth ? 'bg-primary text-background border-primary' : 'bg-transparent text-primary/50 border-primary/30'}`}
                    >
                      Private Key
                    </button>
                  </div>

                  {!useBitcoinAuth ? (
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-[10px] uppercase tracking-wider opacity-70">Username</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username or Email"
                        className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10"
                        required={!useBitcoinAuth}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="privateKey" className="text-[10px] uppercase tracking-wider opacity-70">Bitcoin Private Key (WIF)</Label>
                      <Input
                        id="privateKey"
                        type="password"
                        value={privateKeyInput}
                        onChange={(e) => setPrivateKeyInput(e.target.value)}
                        placeholder="Private Key"
                        className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10"
                        required={useBitcoinAuth}
                      />
                      <p className="text-[9px] text-primary/40 leading-tight">
                        Your private key is used locally to derive your identity. It is never sent to the server.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[10px] uppercase tracking-wider opacity-70">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-3d h-12 text-sm" 
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </TabsContent>

              {/* REGISTER TAB */}
              <TabsContent value="register" className="animate-in fade-in duration-300">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="bg-primary/5 p-3 border border-primary/30 mb-4">
                     <p className="text-[10px] font-mono leading-tight text-primary/70">
                       Registration requires an invite code by default. User identity is tied to mined Bitcoin addresses.
                     </p>
                  </div>

                  {siteSettings?.isInviteOnly !== false && (
                    <div>
                      <Label htmlFor="inviteCode" className="text-[10px] uppercase tracking-wider opacity-70">Invite Code</Label>
                      <div className="relative">
                        <Input
                          id="inviteCode"
                          type="text"
                          value={inviteCode}
                          onChange={(e) => handleInviteCodeChange(e.target.value)}
                          className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10 uppercase pr-10"
                          placeholder="Invite Code"
                          required
                          disabled={loading}
                        />
                        <Key className="absolute right-3 top-2.5 w-4 h-4 text-primary/50" />
                      </div>
                      {inviteCodeError && (
                        <p className="text-red-500 text-[10px] mt-1 font-bold tracking-wider">
                          Error: {inviteCodeError}
                        </p>
                      )}
                      {publicInviteMessage && !inviteCodeError && (
                        <p className="text-blue-500 text-[10px] mt-1 font-bold tracking-wider">
                          Info: {publicInviteMessage}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="reg-username" className="text-[10px] uppercase tracking-wider opacity-70">Username</Label>
                    <Input
                      id="reg-username"
                      type="text"
                      value={registerUsername}
                      onChange={(e) => handleRegisterUsernameChange(e.target.value)}
                      className={`rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10 ${registerUsernameError ? 'border-red-500' : ''}`}
                      placeholder="Username"
                      minLength={MIN_USERNAME_LENGTH}
                      maxLength={MAX_USERNAME_LENGTH}
                      required
                    />
                    {registerUsernameError && (
                      <p className="text-xs text-red-500 mt-1 font-mono">Error: {registerUsernameError}</p>
                    )}
                    {!registerUsernameError && registerUsername.length >= MIN_USERNAME_LENGTH && (
                      <p className="text-xs text-green-500 mt-1 font-mono">Valid</p>
                    )}
                    <p className="text-xs text-primary/50 mt-1 font-mono">{registerUsername.length}/{MAX_USERNAME_LENGTH} characters</p>
                  </div>

                  <div>
                    <Label htmlFor="registerEmail" className="text-[10px] uppercase tracking-wider opacity-70">Email</Label>
                    <Input id="registerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10" required />
                  </div>

                  <div>
                    <Label htmlFor="registerPassword" className="text-[10px] uppercase tracking-wider opacity-70">Password</Label>
                    <Input id="registerPassword" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="rounded-none border-primary/50 focus:border-primary bg-primary/5 text-primary placeholder:text-primary/20 h-10" minLength={8} required />
                  </div>

                  <div className="border-2 border-dashed p-4 rounded border-primary/30">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-[10px] uppercase tracking-wider opacity-70">Bitcoin Identity</Label>
                    </div>

                    {!generatedKeys ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-primary/50 font-mono mb-3">
                          User identity is tied to mined Bitcoin addresses.
                        </p>
                        <Button
                          type="button"
                          onClick={handleGenerateKeys}
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs rounded-none border-primary/50"
                        >
                          <Key className="w-3 h-3 mr-1" />
                          Generate Bitcoin Identity
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-primary/5 p-3 rounded border border-primary/30">
                          <p className="text-xs font-mono text-primary/50 mb-1">Bitcoin Address:</p>
                          <p className="text-xs font-mono break-all text-primary">{generatedKeys.address}</p>
                          <p className="text-xs text-green-500 mt-1 font-mono">{getBitcoinAddressType(generatedKeys.address)}</p>
                        </div>

                        <div className="bg-primary/5 p-3 rounded border border-primary/30">
                          <p className="text-xs font-mono text-primary/50 mb-1">Private Key:</p>
                          {showPrivateKey ? (
                            <p className="text-xs font-mono break-all text-red-500">{generatedKeys.privateKey}</p>
                          ) : (
                            <p className="text-xs font-mono text-primary/50">••••••••••••••••••••</p>
                          )}
                          <Button type="button" onClick={() => setShowPrivateKey(!showPrivateKey)} variant="ghost" size="sm" className="mt-2 font-mono text-xs">
                            {showPrivateKey ? 'Hide' : 'Show'}
                          </Button>
                        </div>

                        <Button type="button" onClick={handleDownloadPrivateKey} variant={hasDownloadedKey ? 'secondary' : 'default'} className="w-full font-mono rounded-none">
                          <Download className="w-4 h-4 mr-2" />
                          {hasDownloadedKey ? 'Key Downloaded' : 'Download Private Key'}
                        </Button>

                        <p className="text-xs text-amber-500 font-mono border-l-2 border-amber-500 pl-2">Security: Download and secure your private key before registering. This key is your unique cryptographic ID.</p>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full btn-3d h-12 text-sm" disabled={loading || !generatedKeys || !hasDownloadedKey}>
                    {loading ? 'Registering...' : 'Register'}
                  </Button>
                </form>
              </TabsContent>

              {/* LURK TAB */}
              <TabsContent value="lurk" className="animate-in fade-in duration-300">
                <div className="font-mono text-xs leading-relaxed space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  
                  {/* Abstract */}
                  <section className="border p-3 border-primary/30">
                    <h2 className="font-bold text-sm mb-2 text-primary">lurk mode</h2>
                    <p className="text-justify text-primary/70">
                      haichan tests the idea that an online community can be made healthier and more interesting by replacing cheap abundance (infinite posts, infinite users, zero-cost identity) with cryptographically enforced scarcity and computational friction.
                    </p>
                  </section>

                  {/* Core Mechanism 1 */}
                  <section className="border p-3 border-primary/30">
                    <h3 className="font-bold text-sm mb-2 text-primary">caps the social graph</h3>
                    <p className="text-justify text-primary/70">
                      A hard ceiling on users (256-sized tranches, invite-gated) turns the board into a finite game. You are not shouting into a global feed; you are interacting inside a closed topology whose participants are known, trackable, and costly to fake.
                    </p>
                  </section>

                  {/* Core Mechanism 2 */}
                  <section className="border p-3 border-primary/30">
                    <h3 className="font-bold text-sm mb-2 text-primary">prices expression in computation</h3>
                    <p className="text-justify text-primary/70">
                      Posting is gated by proof-of-work and protocol-level friction. You can't spam your way to visibility; you have to literally burn cycles. Every post is a small cryptographic artifact with a verifiable cost history.
                    </p>
                  </section>

                  {/* Core Mechanism 3 */}
                  <section className="border p-3 border-primary/30">
                    <h3 className="font-bold text-sm mb-2 text-primary">compresses the medium</h3>
                    <p className="text-justify text-primary/70">
                      Images are aggressively compressed/dithered; the interface is TUI/ssh-like. By constraining bandwidth and aesthetics, haichan foregrounds structure (who can post, at what cost, with what history) over UI spectacle.
                    </p>
                  </section>

                  {/* Core Mechanism 4 */}
                  <section className="border p-3 border-primary/30">
                    <h3 className="font-bold text-sm mb-2 text-primary">responds to work, not vibes</h3>
                    <p className="text-justify text-primary/70">
                      The global state of the board (ordering, visibility, possible actions) is designed to be a function of aggregate work performed by participants. The community doesn't just live on the substrate; it drives it.
                    </p>
                  </section>

                  {/* Core Mechanism 5 */}
                  <section className="border p-3 border-primary/30">
                    <h3 className="font-bold text-sm mb-2 text-primary">treats posts as programmable primitives</h3>
                    <p className="text-justify text-primary/70">
                      Because each post has a cryptographic pedigree and exists in a small, legible space, it can be composed into higher-order systems: reputation markets, computational data markets, or other experiments in valuing small, dense artifacts.
                    </p>
                  </section>

                  {/* Bottom CTA */}
                  <div className="border-2 border-primary bg-primary/5 p-3 text-center">
                    <p className="text-xs mb-2 text-primary/70">Ready to participate?</p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => setActiveTab('login')} 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 font-mono text-xs rounded-none border-primary/50"
                      >
                        LOGIN
                      </Button>
                      <Button 
                        onClick={() => setActiveTab('register')} 
                        size="sm" 
                        className="flex-1 font-mono text-xs rounded-none"
                      >
                        REGISTER
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer Links */}
            <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
              {showAdminSeed && (
                <div>
                  <button type="button" onClick={() => navigate('/seed')} className="text-xs font-mono text-primary/70 hover:text-primary underline">[ADMIN] Seed Test User</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
