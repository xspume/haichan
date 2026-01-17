import { createClient } from '@blinkdotnew/sdk'

export const PROJECT_ID = import.meta.env.VITE_BLINK_PROJECT_ID

if (!PROJECT_ID) {
  console.error('VITE_BLINK_PROJECT_ID is not defined in environment variables')
}

/**
 * Authenticated client (attaches user JWT when signed in).
 * Use for user-scoped writes and any protected modules.
 */
export const db = createClient({
  projectId: PROJECT_ID!,
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY,
  auth: {
    mode: 'headless'
  }
})

/**
 * Public client for global reads.
 *
 * We use a separate client without auth to bypass automatic user_id filtering
 * (RLS) when we want to see ALL records in a table that usually filters by user.
 *
 * IMPORTANT: This client does not use storage to avoid racing with the main client's auth.
 */
export const publicDb = createClient({
  projectId: PROJECT_ID!,
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY,
  // No auth configured = no automatic user_id filtering on the client side
})

export const blink = db
export default db
