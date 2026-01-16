/**
 * Global Realtime Subscription Manager
 * Ensures single active subscription per channel to prevent conflicts
 * Each channel can have multiple listeners without creating duplicate subscriptions
 */

import db from './db-client'

interface Listener {
  id: string
  callback: (message: any) => void
}

interface ChannelState {
  channel: any
  listeners: Map<string, Listener>
  isSubscribed: boolean
  subscriptionPromise: Promise<void> | null
}

const channels = new Map<string, ChannelState>()

/**
 * Check if user is authenticated before attempting realtime connections
 * Realtime requires a valid user JWT to establish WebSocket connection
 */
async function isUserAuthenticated(): Promise<boolean> {
  try {
    const isAuth = db.auth.isAuthenticated()
    return isAuth
  } catch {
    return false
  }
}

/**
 * Subscribe to a realtime channel with automatic deduplication
 * Multiple components can listen to the same channel without conflicts
 * NOTE: Realtime requires authentication - will silently skip if not authenticated
 */
export async function subscribeToChannel(
  channelName: string,
  listenerId: string,
  onMessage: (message: any) => void
): Promise<() => void> {
  // Check authentication before attempting WebSocket connection
  // This prevents "WebSocket error" logs when user is not authenticated
  const isAuth = await isUserAuthenticated()
  if (!isAuth) {
    // Return no-op cleanup function - realtime is non-critical enhancement
    return () => {}
  }

  let channelState = channels.get(channelName)

  // Create channel state if it doesn't exist
  if (!channelState) {
    channelState = {
      channel: db.realtime.channel(channelName),
      listeners: new Map(),
      isSubscribed: false,
      subscriptionPromise: null
    }
    channels.set(channelName, channelState)
  }

  // Wait for any in-progress subscription
  if (channelState.subscriptionPromise) {
    await channelState.subscriptionPromise
  }

  // Add listener
  const listener: Listener = {
    id: listenerId,
    callback: onMessage
  }
  channelState.listeners.set(listenerId, listener)

  // Subscribe to channel if not already subscribed
  if (!channelState.isSubscribed) {
    channelState.subscriptionPromise = subscribeChannelOnce(channelState)
    try {
      await channelState.subscriptionPromise
    } finally {
      channelState.subscriptionPromise = null
    }
  }

  // Return unsubscribe function for cleanup
  return () => {
    channelState!.listeners.delete(listenerId)

    // If no more listeners, unsubscribe from channel
    if (channelState!.listeners.size === 0) {
      channelState!.channel?.unsubscribe().catch(() => {
        // Ignore unsubscribe errors
      })
      channelState!.isSubscribed = false
      channels.delete(channelName)
    }
  }
}

/**
 * Actually subscribe to the channel once and setup message routing
 * Handles timeout and network errors gracefully since realtime is non-critical
 */
async function subscribeChannelOnce(channelState: ChannelState): Promise<void> {
  try {
    await channelState.channel.subscribe()
    channelState.isSubscribed = true

    // Setup message handler that routes to all listeners
    channelState.channel.onMessage((message: any) => {
      // Call all listeners with the message
      for (const listener of channelState.listeners.values()) {
        try {
          listener.callback(message)
        } catch (error) {
          console.error(`Error in listener ${listener.id}:`, error)
        }
      }
    })
  } catch (error: any) {
    channelState.isSubscribed = false
    
    // Check for various network/transient errors - realtime is non-critical
    const errorMessage = String(error?.message || '').toLowerCase()
    const errorName = String(error?.name || '').toLowerCase()
    
    const isTransientError = 
      errorName.includes('realtime') ||
      errorName.includes('network') ||
      errorName.includes('websocket') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('load failed') ||
      errorMessage.includes('network') ||
      errorMessage.includes('websocket') ||
      errorMessage.includes('connection') ||
      error?.status === 0
    
    // Silently handle transient errors - components have fallback mechanisms (polling/caching)
    if (!isTransientError) {
      // Only log truly unexpected errors
      console.warn(`Realtime subscription failed (unexpected):`, error?.message || error)
    }
    // Don't throw - allow components to continue without realtime
  }
}

/**
 * Clean up all subscriptions (useful for testing or app shutdown)
 */
export async function cleanupAllSubscriptions(): Promise<void> {
  for (const channelState of channels.values()) {
    try {
      await channelState.channel.unsubscribe()
    } catch (error) {
      console.error('Error unsubscribing:', error)
    }
  }
  channels.clear()
}