import db from '../db-client'
import { invokeFunction } from '../functions-utils'

export interface MiningResult {
  hash: string
  nonce: string
  points: number
  trailingZeros: number
  attempts: number
  hashRate: number
  challenge?: string
}

export interface MiningShare {
  hash: string
  nonce: string
  points: number
  trailingZeros: number
  attempts: number
  challenge: string
}

export interface MiningProgress {
  hash: string
  nonce: string
  points: number
  trailingZeros: number
  attempts: number
  hashRate: number
  challenge?: string
  powerMode?: 'high' | 'low' | 'lurk'
}

export type MiningCallback = (progress: MiningProgress) => void
export type ShareCallback = (share: MiningShare) => void
export type CompleteCallback = (result: MiningResult) => void

export class MiningEngine {
  private worker: Worker | null = null
  private challenge: string = ''
  private callbacks: Set<MiningCallback> = new Set()
  private shareCallback: ShareCallback | null = null
  private completeCallback: CompleteCallback | null = null
  private mining: boolean = false
  private currentTarget: { type: string; id?: string } | null = null
  private lastResult: MiningResult | null = null
  private lastPrefix: string = '21e8'
  private lastChallenge: string = ''
  private lastRealtimeTimeoutWarnAt = 0

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    try {
      // Use Vite worker import instead of blob
      console.log('[MiningEngine] Creating worker...')
      this.worker = new Worker(new URL('../../workers/hash.worker.ts', import.meta.url), {
        type: 'module'
      })
      console.log('[MiningEngine] ✓ Worker created successfully')

      this.worker.onmessage = (e: MessageEvent) => {
        const { type, data } = e.data

        // console.log('[MiningEngine] Worker message:', type, data?.points || data?.hash?.substring(0, 16))

        switch (type) {
          case 'share':
            if (data && this.shareCallback) {
                // Use the challenge sent by the worker to ensure correctness
                this.shareCallback({ ...data, challenge: data.challenge || this.challenge })
            }
            break

          case 'progress':
            // Update callbacks with progress
            if (data) {
              // console.log('[MiningEngine] Progress update:', data.points, 'pts', data.attempts, 'attempts')
              this.callbacks.forEach(cb => cb(data))
            }
            break

          case 'complete':
            // Handle mining completion
            console.log('[MiningEngine] Mining complete:', data)
            this.handleComplete(data)
            break

          case 'stopped':
            this.mining = false
            console.log('[MiningEngine] Mining stopped by user')
            break

          default:
            console.warn('[MiningEngine] Unknown worker message type:', type)
        }
      }

      this.worker.onerror = (error: ErrorEvent) => {
        console.error('[MiningEngine] Worker error:', error.message, error.filename, error.lineno)
      }
    } catch (error) {
      console.error('Failed to initialize mining worker:', error)
    }
  }

  async generateChallenge(identity?: string): Promise<string> {
    // Generate random challenge
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const randomHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
    
    // If identity is provided, incorporate it into the challenge to bind PoW to identity
    if (identity) {
      const encoder = new TextEncoder()
      const data = encoder.encode(randomHex + identity)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      this.challenge = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } else {
      this.challenge = randomHex
    }
    
    return this.challenge
  }

  async startMining(
    targetType: string,
    targetId: string | undefined,
    targetPoints: number = 15,
    onProgress?: MiningCallback,
    prefix: string = '21e8',
    batchSize: number = 5000,
    onShare?: ShareCallback,
    shareDifficulty: number = 15,
    onComplete?: CompleteCallback,
    identity?: string
  ): Promise<void> {
    if (this.mining) {
      this.stopMining()
    }

    // Always generate a fresh challenge, potentially tied to identity
    await this.generateChallenge(identity)

    this.mining = true
    this.currentTarget = { type: targetType, id: targetId }
    this.lastPrefix = prefix // Store prefix for PoW validation
    this.shareCallback = onShare || null
    this.completeCallback = onComplete || null

    if (onProgress) {
      this.callbacks.add(onProgress)
    }

    this.worker?.postMessage({
      type: 'start',
      data: { 
        challenge: this.challenge, 
        targetPoints, 
        prefix, 
        batchSize, 
        shareDifficulty,
        powerMode: 'high' // Default to high on start
      }
    })
  }

  setPowerMode(mode: 'high' | 'low' | 'lurk'): void {
    this.worker?.postMessage({
      type: 'set_power_mode',
      data: { mode }
    })
  }

  stopMining(): void {
    // Mark mining as stopped and clear target so any late worker messages are ignored
    this.mining = false
    this.currentTarget = null

    this.worker?.postMessage({ type: 'stop' })
    this.callbacks.clear()
    this.shareCallback = null
    this.completeCallback = null
  }

  private async handleComplete(result: MiningResult, userId?: string): Promise<void> {
    this.mining = false
    
    // Store callbacks before clearing
    const onComplete = this.completeCallback;
    
    this.callbacks.clear()
    this.shareCallback = null
    this.completeCallback = null

    // Store the latest result AND challenge for PoW validation
    // Prefer challenge from result if available
    const finalChallenge = result.challenge || this.challenge
    this.lastResult = result
    this.lastChallenge = finalChallenge

    // Capture currentTarget early to avoid race conditions
    const targetInfo = this.currentTarget
    this.currentTarget = null

    // Notify completion callback immediately so UI can update
    if (onComplete) {
      onComplete(result);
    }

    console.log('[MiningEngine.handleComplete] Processing result:', {
      points: result.points,
      hash: result.hash.substring(0, 16) + '...',
      targetType: targetInfo?.type,
      targetId: targetInfo?.id
    })

    if (!targetInfo) {
      console.warn('[MiningEngine.handleComplete] No target info captured')
      return
    }

    try {
      let finalUserId = userId
      
      if (!finalUserId) {
        // Try to get user from auth if not provided
        try {
          const user = await db.auth.me()
          finalUserId = user?.id
        } catch (e) {
          console.warn('[MiningEngine.handleComplete] Failed to fetch user for PoW submission:', e)
        }
      }
      
      if (!finalUserId) {
        // User is not authenticated - this is normal on public pages (auth, home, etc)
        console.log('[MiningEngine.handleComplete] No userId provided - skipping PoW recording')
        return
      }

      console.log('[MiningEngine.handleComplete] Saving PoW via validate-pow for user:', finalUserId)

      // Submit via Edge Function with retry mechanism
      const submitPoW = async (retryCount = 0): Promise<boolean> => {
        try {
          const { data, error } = await invokeFunction('validate-pow', {
            body: {
              challenge: this.lastChallenge,
              nonce: result.nonce,
              hash: result.hash,
              points: result.points,
              trailingZeros: result.trailingZeros,
              prefix: this.lastPrefix,
              targetType: targetInfo.type,
              targetId: targetInfo.id || '',
              userId: finalUserId
            }
          })

          if (error || !data?.valid) {
            console.error('PoW submission failed:', error || data?.error)
            
            // Retry on network errors (max 3 retries for handleComplete as it's critical)
            if (retryCount < 3 && (error?.message?.includes('fetch') || error?.name === 'BlinkNetworkError')) {
              console.log(`[MiningEngine] Retrying PoW submission (attempt ${retryCount + 1})...`)
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
              return await submitPoW(retryCount + 1)
            }
            return false
          }

          console.log('[MiningEngine.handleComplete] ✓ PoW recorded successfully via Edge Function')
          return true
        } catch (err) {
          console.error('[MiningEngine] Exception during PoW submission:', err)
          return false
        }
      }

      const success = await submitPoW()
      if (!success) return

      // Publish realtime event for mining completion
      try {
        const shouldSuppressRealtimeError = (err: any) => {
          const isTimeout =
            err?.name === 'BlinkRealtimeError' &&
            typeof err?.message === 'string' &&
            err.message.toLowerCase().includes('timeout')

          if (!isTimeout) return false

          const now = Date.now()
          if (now - this.lastRealtimeTimeoutWarnAt > 20_000) {
            this.lastRealtimeTimeoutWarnAt = now
            console.warn('[MiningEngine.handleComplete] Realtime send timeout (non-critical)')
          }
          return true
        }

        const safePublish = async (channel: string, event: string, payload: any) => {
          try {
            await db.realtime.publish(channel, event, payload)
            return true
          } catch (err) {
            if (shouldSuppressRealtimeError(err)) return false
            console.warn('[MiningEngine.handleComplete] Realtime publish failed (non-critical):', err)
            return false
          }
        }

        // 1. Broadcast to general updates channel for components like DiamondHashDisplay
        await safePublish('mining-updates', 'mining-complete', {
          userId: finalUserId,
          targetType: targetInfo.type,
          targetId: targetInfo.id,
          points: result.points,
          trailingZeros: result.trailingZeros,
          hash: result.hash
        })

        // 2. Broadcast to specific channels based on target type
        if (targetInfo.type === 'thread' && targetInfo.id) {
          // Get board slug for thread
          const threads = await db.db.threads.list({
            where: { id: targetInfo.id },
            limit: 1
          })
          if (threads.length > 0) {
            const boards = await db.db.boards.list({
              where: { id: threads[0].boardId },
              limit: 1
            })
            if (boards.length > 0) {
              await safePublish(`board-${boards[0].slug}`, 'pow_completed', {
                targetType: 'thread',
                targetId: targetInfo.id,
                points: result.points
              })
            }
          }
        } else if (targetInfo.type === 'post' && targetInfo.id) {
          // Get post -> thread -> board
          const posts = await db.db.posts.list({
            where: { id: targetInfo.id },
            limit: 1
          })
          if (posts.length > 0) {
            const threads = await db.db.threads.list({
              where: { id: posts[0].threadId },
              limit: 1
            })
            if (threads.length > 0) {
              const boards = await db.db.boards.list({
                where: { id: threads[0].boardId },
                limit: 1
              })
              if (boards.length > 0) {
                await safePublish(`board-${boards[0].slug}`, 'pow_completed', {
                  targetType: 'post',
                  targetId: targetInfo.id,
                  points: result.points
                })
              }
            }
          }
        } else if (targetInfo.type === 'blog' && targetInfo.id) {
          await safePublish('blogs', 'pow_completed', {
            targetType: 'blog',
            targetId: targetInfo.id,
            points: result.points
          })
        }
        
        console.log('[MiningEngine.handleComplete] pow_completed event published')
      } catch (realtimeError) {
        if (
          realtimeError?.name === 'BlinkRealtimeError' &&
          typeof realtimeError?.message === 'string' &&
          realtimeError.message.toLowerCase().includes('timeout')
        ) {
          // Non-critical: realtime is an enhancement, PoW was already recorded.
          const now = Date.now()
          if (now - this.lastRealtimeTimeoutWarnAt > 20_000) {
            this.lastRealtimeTimeoutWarnAt = now
            console.warn('[MiningEngine.handleComplete] Realtime send timeout (non-critical)')
          }
        } else {
          console.warn('[MiningEngine.handleComplete] Failed to publish realtime event (non-critical):', realtimeError)
        }
      }

    } catch (error: any) {
      // Silently handle rate limit errors - PoW is still valid for submission
      if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED') {
        console.log('[MiningEngine.handleComplete] Rate limit hit - PoW will be recorded on next submission')
      } else {
        console.error('[MiningEngine.handleComplete] Error recording PoW:', error)
      }
    }
  }

  private async updateTargetPoW(_targetType: string, _targetId: string, _points: number): Promise<void> {
    // Deprecated: Now handled by validate-pow edge function
    console.warn('[updateTargetPoW] Deprecated - handled by edge function')
  }

  isMining(): boolean {
    return this.mining
  }

  public getCurrentChallenge(): string {
    return this.challenge
  }

  getLastPoWResult(): { result: MiningResult; challenge: string; prefix: string } | null {
    if (!this.lastResult || !this.lastChallenge) return null
    return {
      result: this.lastResult,
      challenge: this.lastChallenge,
      prefix: this.lastPrefix
    }
  }

  clearLastPoWResult(): void {
    this.lastResult = null
  }

  destroy(): void {
    this.stopMining()
    this.worker?.terminate()
    this.worker = null
  }
}
