/**
 * Simple in-memory cache with TTL for request caching
 * Reduces DB load by caching frequent queries
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>()
  private pendingRequests = new Map<string, Promise<any>>()
  private lastAuthState: string | null = null

  /**
   * Call this when auth state changes to clear stale cached data
   * This ensures data is refetched with the new auth context
   */
  onAuthStateChange(userId: string | null): void {
    const newAuthState = userId ?? 'anonymous'
    
    // Only clear cache if auth state actually changed
    if (this.lastAuthState !== null && this.lastAuthState !== newAuthState) {
      console.log('[RequestCache] Auth state changed, clearing cache')
      this.clear()
    }
    
    this.lastAuthState = newAuthState
  }

  /**
   * Get cached data or fetch fresh data
   * Uses request deduplication to prevent multiple concurrent requests for the same key
   * On network errors, returns stale cache data if available
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    const cached = this.cache.get(key)

    if (cached && Date.now() < cached.expiresAt) {
      // If data is an empty array or null, we might want to allow re-fetch sooner
      const isEmpty = Array.isArray(cached.data) ? cached.data.length === 0 : !cached.data
      const staleGracePeriod = 2000 // 2 second grace period for empty results
      
      if (!isEmpty || Date.now() < cached.expiresAt - (ttlMs - staleGracePeriod)) {
        return cached.data
      }
    }

    // Check if there's already a pending request for this key (deduplication)
    const pending = this.pendingRequests.get(key)
    if (pending) {
      return pending
    }

    // Create new fetch request
    const fetchPromise = (async () => {
      try {
        const data = await fetchFn()

        // Cache the result
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + ttlMs
        })

        return data
      } catch (error: any) {
        // On network errors, return stale cache if available
        // This provides graceful degradation during connectivity issues
        if (cached) {
          return cached.data
        }
        // Re-throw if no stale data available
        throw error
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(key)
      }
    })()

    // Store pending request for deduplication
    this.pendingRequests.set(key, fetchPromise)

    return fetchPromise
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate keys matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }
}

export const requestCache = new RequestCache()