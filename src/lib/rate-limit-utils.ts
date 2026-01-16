/**
 * Rate Limit Utility Module
 * 
 * Implements exponential backoff, request queuing, and retry logic
 * for handling rate-limited database endpoints.
 * Ensures sequential execution to avoid hammering the API.
 */

interface RateLimitConfig {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  timeoutMs?: number
}

interface QueuedRequest<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
  retries: number
  config: Required<RateLimitConfig>
}

class RateLimitManager {
  private requestQueue: QueuedRequest<any>[] = []
  private activeCount = 0
  // Keep concurrency low to avoid opening many long-lived requests (Blink SDK calls aren't abortable).
  // High concurrency + timeouts can leave zombie in-flight requests and cause subsequent calls to time out.
  private maxConcurrency = 2
  private lastRequestTime = 0
  private minDelayBetweenRequests = 50 // ms

  private defaultConfig: Required<RateLimitConfig> = {
    maxRetries: 10,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    // Give the SDK a bit more breathing room; individual callers can still override.
    timeoutMs: 60000
  }

  /**
   * Check if error is a rate limit or server error
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false

    const message = String(error?.message || '').toLowerCase()
    const details = String(error?.details || '').toLowerCase()
    const status = error?.status

    // Check for common rate limit or temporary server indicators
    return (
      status === 429 ||
      status === 503 ||
      status === 502 ||
      status === 504 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota') ||
      message.includes('throttle') ||
      message.includes('unavailable') ||
      details.includes('rate limit') ||
      details.includes('too many') ||
      error?.code === 'RATE_LIMITED' ||
      error?.code === 'QUOTA_EXCEEDED' ||
      error?.code === 'NETWORK_ERROR'
    )
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async enforceMinDelay(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      // Use jittered delay to prevent synchronization
      const delayAmount = (this.minDelayBetweenRequests - timeSinceLastRequest) + (Math.random() * 50)
      await this.delay(delayAmount)
    }
    this.lastRequestTime = Date.now()
  }

  private async executeWithRetry<T>(request: QueuedRequest<T>): Promise<T> {
    const { fn, retries, config } = request
    
    try {
      await this.enforceMinDelay()
      
      // Add a hard timeout to the function execution
      // NOTE: We must clear the timer to avoid leaking timers + stray rejections after Promise.race resolves.
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out')), config.timeoutMs)
      })

      const fnPromise = fn()
      try {
        const result = await Promise.race([fnPromise, timeoutPromise])
        return result as T
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        // Ensure fnPromise rejections are handled if it settles after a timeout.
        fnPromise.catch(() => {})
      }
    } catch (error) {
      if (this.isRetryableError(error) && retries < config.maxRetries) {
        const delayMs = config.initialDelayMs * Math.pow(config.backoffMultiplier, retries)
        const jitter = Math.random() * 0.3 * delayMs
        const finalDelay = Math.min(delayMs + jitter, config.maxDelayMs)
        
        console.warn(
          `[RateLimit] Request failed (attempt ${retries + 1}/${config.maxRetries}). ` +
          `Retrying in ${finalDelay.toFixed(0)}ms...`,
          error
        )
        
        await this.delay(finalDelay)
        request.retries++
        return this.executeWithRetry(request)
      }
      throw error
    }
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency || this.requestQueue.length === 0) {
      return
    }

    while (this.requestQueue.length > 0 && this.activeCount < this.maxConcurrency) {
      const request = this.requestQueue.shift()
      if (!request) break

      this.activeCount = this.activeCount + 1
      
      // Process request asynchronously to allow concurrency
      this.processRequest(request)
    }
  }

  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await this.executeWithRetry(request)
      request.resolve(result)
    } catch (error) {
      request.reject(error)
    } finally {
      this.activeCount = this.activeCount - 1
      // Trigger next queue processing
      this.processQueue()
    }
  }

  async execute<T>(fn: () => Promise<T>, config?: RateLimitConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        fn,
        resolve,
        reject,
        retries: 0,
        config: { ...this.defaultConfig, ...config }
      })
      this.processQueue().catch(err => {
        console.error('[RateLimit] Critical error in queue processing:', err)
        const newCount = this.activeCount - 1
        this.activeCount = Math.max(0, newCount)
      })
    })
  }

  getQueueLength(): number {
    return this.requestQueue.length
  }

  clearQueue(): void {
    this.requestQueue.forEach(req => req.reject(new Error('Queue cleared')))
    this.requestQueue = []
    this.activeCount = 0
  }
}

// Create single global manager instance
const globalManager = new RateLimitManager()

/**
 * Execute a function with automatic rate limit handling and global queuing
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): Promise<T> {
  return globalManager.execute(fn, config)
}

/**
 * Execute multiple requests in parallel with rate limit handling
 */
export async function batchWithRateLimit<T>(
  fns: Array<() => Promise<T>>,
  batchSize = 2, // Reduced batch size for safety
  config?: RateLimitConfig
): Promise<T[]> {
  const results: T[] = []

  // Even though withRateLimit uses a sequential global queue, 
  // we still batch them here to control how many we "fire" at once
  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = fns.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(fn => withRateLimit(fn, config))
    )
    results.push(...batchResults)
  }

  return results
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): Promise<T> {
  return globalManager.execute(fn, config)
}

export function rateLimitWrapper<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): () => Promise<T> {
  return () => withRateLimit(fn, config)
}

export function getRateLimitStats() {
  return {
    queueLength: globalManager.getQueueLength(),
    timestamp: new Date().toISOString()
  }
}

export function clearRateLimitQueue(): void {
  globalManager.clearQueue()
}

/**
 * Check if an error is a transient/retryable error (network, rate limit, etc.)
 * Use this to determine whether to log errors or silently handle them
 */
export function isTransientError(error: any): boolean {
  if (!error) return false
  
  const errorMessage = String(error?.message || '').toLowerCase()
  const errorName = String(error?.name || '').toLowerCase()
  const errorCode = String(error?.code || '').toLowerCase()
  const status = error?.status
  
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 0 ||
    errorCode === 'rate_limit_exceeded' ||
    errorCode === 'rate_limited' ||
    errorCode === 'network_error' ||
    errorCode === 'quota_exceeded' ||
    errorName === 'blinknetworkerror' ||
    errorName.includes('network') ||
    errorName.includes('timeout') ||
    errorMessage.includes('load failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('throttle') ||
    errorMessage.includes('unavailable') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('failed to fetch')
  )
}

export default withRateLimit
