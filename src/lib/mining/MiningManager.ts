/**
 * MiningManager: High-level orchestration for mining operations
 * Manages granular point streams, adaptive difficulty, and session prioritization.
 * Implements Singleton pattern.
 */

import { MiningEngine, MiningProgress, MiningShare } from './MiningEngine'
import db from '../db-client'
import { invokeFunction } from '../functions-utils'

function isNetworkishError(err: any) {
  if (!err) return false
  const name = err?.name || err?.value?.name
  const message = String(err?.message || err?.value?.message || err).toLowerCase()
  const code = err?.code || err?.value?.code
  const status = err?.status || err?.value?.status

  return Boolean(
    err?.isNetwork ||
      name === 'BlinkNetworkError' ||
      code === 'NETWORK_ERROR' ||
      status === 0 ||
      message.includes('failed to fetch') ||
      message.includes('network error') ||
      message.includes('load failed')
  )
}

export type MiningMode = 'background' | 'dedicated' | 'mouseover'

export interface MiningSession {
  mode: MiningMode
  targetType: string
  targetId?: string
  targetPoints: number
  prefix: string
  identity?: string
  startTime: number
  currentProgress: MiningProgress | null
  accumulatedPoints: number
  pendingPoints: number // Points not yet flushed to backend
  paused: boolean
}

type MiningManagerListener = (sessions: MiningSession[]) => void

/**
 * Adaptive difficulty based on user performance
 * Prioritizes: Dedicated > Mouseover > Background
 */
export class MiningManager {
  private static instance: MiningManager
  private engine: MiningEngine
  private sessions: MiningSession[] = []
  private listeners: Set<MiningManagerListener> = new Set()
  private isMobile: boolean = false
  private pendingShares: MiningShare[] = []
  private flushTimer: any = null
  private lastActiveParams: string = ''
  private pauseSubmissionsUntil = 0

  private constructor() {
    this.engine = new MiningEngine()
    this.isMobile = this.detectMobile()
    this.startFlushInterval()
    this.setupVisibilityListener()
    this.setupBatteryListener()
    
    // Debug Blink SDK client
    if (!db) {
      console.error('[MiningManager] Blink DB client is undefined')
    }
  }

  private setupVisibilityListener() {
    if (typeof document === 'undefined') return
    
    document.addEventListener('visibilitychange', () => {
      this.updatePowerMode()
    })
  }

  private async setupBatteryListener() {
    if (typeof navigator === 'undefined' || !('getBattery' in navigator)) return
    
    try {
      const battery: any = await (navigator as any).getBattery()
      battery.addEventListener('levelchange', () => this.updatePowerMode())
      battery.addEventListener('chargingchange', () => this.updatePowerMode())
      this.updatePowerMode()
    } catch (e) {
      console.warn('[MiningManager] Battery API not supported or failed:', e)
    }
  }

  private async updatePowerMode() {
    let mode: 'high' | 'low' | 'lurk' = 'high'
    
    // 1. Check visibility
    const isHidden = typeof document !== 'undefined' && document.hidden
    
    // 2. Check battery
    let isLowBattery = false
    let isCharging = true
    
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery()
        isLowBattery = battery.level < 0.2
        isCharging = battery.charging
      } catch (e) {
        // Ignore
      }
    }

    if (isHidden) {
      mode = 'lurk' // Background mining = Lurk mode
    } else if (isLowBattery && !isCharging) {
      mode = 'low'
    } else if (this.isMobile) {
      // On mobile, even if visible, maybe we want 'low' if not charging?
      // For now let's stick to high if visible and not low battery
      mode = isLowBattery ? 'low' : 'high'
    }

    console.log(`[MiningManager] Updating power mode: ${mode} (Hidden: ${isHidden}, LowBatt: ${isLowBattery}, Charging: ${isCharging})`)
    this.engine.setPowerMode(mode)
  }

  private startFlushInterval() {
    if (this.flushTimer) clearInterval(this.flushTimer)
    // Flush every 10 seconds
    this.flushTimer = setInterval(() => this.flushShares(), 10000)
  }

  private handleProgress = (progress: MiningProgress) => {
    const activeSession = this.getActiveSession()
    if (activeSession) {
      activeSession.currentProgress = progress
      this.emit()
    }
  }

  private getActiveSession(): MiningSession | undefined {
    return this.sessions.find(s => s.mode === 'dedicated') ||
           this.sessions.find(s => s.mode === 'mouseover') ||
           this.sessions.find(s => s.mode === 'background')
  }

  private handleShare = (share: MiningShare) => {
    // console.log('[MiningManager] Share found:', share.points)
    this.pendingShares.push(share)
    
    // Update accumulated points for the active session (dedicated > mouseover > background)
    const activeSession = this.getActiveSession()

    if (activeSession) {
        activeSession.accumulatedPoints = (activeSession.accumulatedPoints || 0) + share.points
        activeSession.pendingPoints = (activeSession.pendingPoints || 0) + share.points
        this.emit() // Notify listeners (UI)
    }
    
    // Flush if buffer gets too large (reduced to 25 for better stability)
    if (this.pendingShares.length >= 25) {
        this.flushShares()
    }
    }

  private async flushShares() {
    if (this.pendingShares.length === 0) return

    if (Date.now() < this.pauseSubmissionsUntil) {
      return
    }

    const batch = [...this.pendingShares]
    this.pendingShares = [] // clear buffer immediately; we may re-queue on failure
    
    // Calculate total points in this batch for accurate accounting
    const batchTotalPoints = batch.reduce((sum, share) => sum + share.points, 0)

    // Determine target from active session (dedicated > mouseover > background)
    const activeSession = this.getActiveSession()
    
    // If no active session, we can't attribute shares
    if (!activeSession) {
        console.warn('[MiningManager] No active session for flushed shares, discarding.')
        return
    }

    console.log(`[MiningManager] Flushing ${batch.length} shares (${batchTotalPoints} pts) for ${activeSession.targetType}:${activeSession.targetId || 'global'}`);

    // Wrap submission in a function for potential retries
    const submitBatch = async (retryCount = 0): Promise<boolean> => {
      try {
          let user = null
          try {
              user = await db.auth.me()
          } catch (e) {
              // Ignore auth errors, treat as unauthenticated
          }

          if (!user) {
              console.log('[MiningManager] No authenticated user, skipping batch submission')
              return false
          }

          const { data, error } = await invokeFunction('validate-pow', {
              body: {
                  shares: batch,
                  targetType: activeSession.targetType,
                  targetId: activeSession.targetId || 'global',
                  userId: user.id,
                  prefix: activeSession.prefix
              }
          })

          if (error) {
              const networkish = isNetworkishError(error)
              if (networkish) {
                // CORS/network errors surface as "NetworkError" in browsers and should not spam logs.
                console.warn('[MiningManager] Batch submission network error; pausing submissions temporarily')
                this.pauseSubmissionsUntil = Date.now() + (error.retryAfterMs || 30_000)
                // Re-queue the batch so points are not lost.
                this.pendingShares = [...batch, ...this.pendingShares]
              } else {
                console.error('[MiningManager] Batch submission failed:', error)
              }
              
              if (error.message?.includes('No valid shares')) {
                console.warn('[MiningManager] Server rejected all shares in batch. This might be a challenge/nonce mismatch.');
                // Log the first share for debugging
                if (batch.length > 0) {
                  console.debug('[MiningManager] Debug share 0:', {
                    hash: batch[0].hash,
                    challenge: batch[0].challenge,
                    nonce: batch[0].nonce
                  });
                }
              }

              // Retry on transient errors (max 2 retries). For network/CORS failures we pause instead.
              if (!networkish && retryCount < 2 && (error.message?.includes('fetch') || error.name === 'BlinkNetworkError')) {
                console.log(`[MiningManager] Retrying submission (attempt ${retryCount + 1})...`)
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)))
                return await submitBatch(retryCount + 1)
              }
              return false
          } else {
              console.log(`[MiningManager] Batch submitted: ${data?.totalPoints} points added`)
              // Subtract flushed points from pendingPoints to update UI
              if (activeSession) {
                  activeSession.pendingPoints = Math.max(0, (activeSession.pendingPoints || 0) - batchTotalPoints)
                  this.emit()
              }
              return true
          }
      } catch (err) {
          if (isNetworkishError(err)) {
            console.warn('[MiningManager] Network exception while flushing shares; pausing submissions temporarily')
            this.pauseSubmissionsUntil = Date.now() + 30_000
            this.pendingShares = [...batch, ...this.pendingShares]
          } else {
            console.error('[MiningManager] Error flushing shares:', err)
          }
          return false
      }
    }

    await submitBatch()
  }

  public static getInstance(): MiningManager {
    if (!MiningManager.instance) {
      console.log('[MiningManager] Creating new instance')
      MiningManager.instance = new MiningManager()
    }
    return MiningManager.instance
  }

  public getCurrentChallenge(): string {
    return this.engine.getCurrentChallenge()
  }

  public getLastPoWResult() {
    return this.engine.getLastPoWResult()
  }

  public clearLastPoWResult() {
    this.engine.clearLastPoWResult()
  }

  public getActiveSessions(): MiningSession[] {
    return this.sessions
  }

  public getSession(mode: MiningMode): MiningSession | undefined {
    return this.sessions.find(s => s.mode === mode)
  }

  private detectMobile(): boolean {
    if (typeof navigator === 'undefined') return false
    return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }

  public subscribe(listener: MiningManagerListener): () => void {
    this.listeners.add(listener)
    listener(this.sessions) // Initial emit
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    this.listeners.forEach(listener => listener([...this.sessions]))
  }

  /**
   * Start a high-priority dedicated mining session (e.g. manual "Mine" button)
   */
  async startDedicatedMining(
    targetType: string,
    targetId: string | undefined,
    basePoints: number = 15,
    prefix: string = '21e8'
  ): Promise<void> {
    console.log('[MiningManager] startDedicatedMining', { targetType, targetId, basePoints, prefix })
    // Stop any existing dedicated session
    this.stopDedicatedMining()

    // Get user identity (bitcoin address) to bind PoW
    let identity: string | undefined
    try {
      const user = await db.auth.me()
      const profile = await db.db.users.get(user.id)
      identity = profile?.bitcoinAddress
    } catch (e) {
      // Ignore auth errors
    }

    // Create new dedicated session
    // Don't reduce points on mobile - dedicated mining usually has strict requirements (e.g. posting)
    const session: MiningSession = {
      mode: 'dedicated',
      targetType,
      targetId,
      targetPoints: basePoints,
      prefix,
      identity,
      startTime: Date.now(),
      currentProgress: null,
      accumulatedPoints: 0,
      pendingPoints: 0,
      paused: false
    }

    this.sessions.push(session)
    this.updateEngine()
  }

  stopDedicatedMining(): void {
    console.log('[MiningManager] stopDedicatedMining')
    this.sessions = this.sessions.filter(s => s.mode !== 'dedicated')
    this.updateEngine()
  }

  /**
   * Start a mouseover mining session (medium priority)
   */
  startMouseoverMining(
    targetType: string,
    targetId: string,
    element: HTMLElement
  ): () => void {
    // We rely on the caller (hook) to handle device-specific events (touch vs mouse)
    // so we don't strictly block mobile here anymore.
    
    console.log('[MiningManager] startMouseoverMining', { targetType, targetId })

    // Create a unique cleanup function that we'll populate once we have the identity
    let miningCleanup: (() => void) | null = null
    let isStopped = false

    // Fetch identity and then start mining
    const initMining = async () => {
      let identity: string | undefined
      try {
        const user = await db.auth.me()
        const profile = await db.db.users.get(user.id)
        identity = profile?.bitcoinAddress
      } catch (e) {
        // Ignore auth errors
      }

      if (isStopped) return

      // Create new mouseover session
      const session: MiningSession = {
        mode: 'mouseover',
        targetType,
        targetId,
        targetPoints: 1000000, // Infinite/until stop
        prefix: '21e8',
        identity,
        startTime: Date.now(),
        currentProgress: null,
        accumulatedPoints: 0,
        pendingPoints: 0,
        paused: false
      }

      // Add to sessions
      this.sessions = this.sessions.filter(s => s.mode !== 'mouseover')
      this.sessions.push(session)
      this.updateEngine()

      miningCleanup = () => {
        this.sessions = this.sessions.filter(s => s !== session)
        this.updateEngine()
      }
    }

    initMining()

    return () => {
      isStopped = true
      if (miningCleanup) {
        miningCleanup()
      } else {
        // If it hasn't started yet, ensure any pending session is cleared
        this.sessions = this.sessions.filter(s => s.mode !== 'mouseover')
        this.updateEngine()
      }
    }
  }

  /**
   * Start background mining (lowest priority)
   */
  async startBackgroundMining(targetType: string = 'global', targetId?: string): Promise<void> {
    console.log('[MiningManager] startBackgroundMining', { targetType, targetId })
    // Only one background session allowed
    if (this.sessions.some(s => s.mode === 'background')) return

    // Get user identity (bitcoin address) to bind PoW
    let identity: string | undefined
    try {
      const user = await db.auth.me()
      const profile = await db.db.users.get(user.id)
      identity = profile?.bitcoinAddress
    } catch (e) {
      // Ignore auth errors
    }

    const session: MiningSession = {
      mode: 'background',
      targetType,
      targetId,
      targetPoints: 0, // 0 means infinite/streaming
      prefix: '21e8',
      identity,
      startTime: Date.now(),
      currentProgress: null,
      accumulatedPoints: 0,
      pendingPoints: 0,
      paused: false
    }

    this.sessions.push(session)
    this.updateEngine()
  }

  stopAllMining(): void {
    console.log('[MiningManager] stopAllMining')
    this.sessions = []
    this.flushShares() // Flush any remaining shares
    this.updateEngine()
  }

  private getAdjustedPoints(basePoints: number): number {
    // On mobile, reduce initial target to show faster feedback
    return this.isMobile ? Math.max(3, Math.floor(basePoints / 3)) : basePoints
  }

  /**
   * Reconcile sessions and update the engine
   * Priority: Dedicated > Mouseover > Background
   */
  private updateEngine() {
    // Determine active session based on priority
    const activeSession = this.getActiveSession()
    let priorityReason = 'none'

    if (activeSession) {
      priorityReason = activeSession.mode
    }

    // Update paused states
    this.sessions.forEach(s => {
      s.paused = s !== activeSession
      // Clear progress for paused sessions to avoid stale hash rates
      if (s.paused) {
        s.currentProgress = null
      }
    })

    this.emit()

    if (activeSession) {
      // Check if we can skip restarting the worker
      // Construct a unique key for the mining parameters
      const paramsKey = `${activeSession.targetType}:${activeSession.targetId}:${activeSession.targetPoints}:${activeSession.prefix}`
      
      if (this.engine.isMining() && this.lastActiveParams === paramsKey) {
        // Parameters haven't changed, just ensure callbacks are set (they persist in engine)
        // No need to restart worker
        // console.log('[MiningManager] Skipping restart, same params')
        return
      }

      this.lastActiveParams = paramsKey

      // Pass handleShare for all modes to ensure live point updates
      // This allows the UI to show accumulated points in real-time
      const onShare = this.handleShare

      // Callback when mining completes (for dedicated mining)
      const onComplete = () => {
        // Force emit immediately to show completion state
        this.emit()

        // Remove dedicated session on completion after a short delay for UX
        if (activeSession.mode === 'dedicated') {
          setTimeout(() => {
            this.sessions = this.sessions.filter(s => s !== activeSession)
            this.emit()
          }, 1500)
        }
      }

      this.engine.startMining(
        activeSession.targetType,
        activeSession.targetId,
        activeSession.targetPoints, // 0 for background
        this.handleProgress,
        activeSession.prefix,
        this.getAdaptiveBatchSize(),
        onShare,
        15, // Share difficulty (15 pts = "21e8" in worker logic)
        onComplete,
        activeSession.identity
      )
    } else {
      console.log('[MiningManager] No active session, stopping engine')
      this.lastActiveParams = ''
      this.engine.stopMining()
    }
  }

  /**
   * Get adaptive batch size based on device performance
   * Smaller batches = faster hash rate feedback (but slightly lower peak hash rate)
   */
  getAdaptiveBatchSize(): number {
    if (this.isMobile) {
      return 1000 // Mobile: smaller batches for snappier feedback
    }
    return 2000 // Desktop: moderate batches for quick feedback while maintaining performance
  }

  isMobile_(): boolean {
    return this.isMobile
  }

  destroy(): void {
    this.stopAllMining()
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.engine.destroy()
  }
}