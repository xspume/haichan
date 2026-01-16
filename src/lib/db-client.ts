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
 * Public client (does NOT attach user JWT).
 * IMPORTANT: Our DB module is configured public in security policy. When a user is logged in,
 * using the authenticated client can trigger RLS user-scoping and return empty lists.
 * Use this client for global/public reads (boards, threads, posts, public blogs, leaderboards).
 */
export const publicDb = createClient({
  projectId: PROJECT_ID!,
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY
})

export const blink = db
export default db
