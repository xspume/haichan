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
 * Public client
 *
 * IMPORTANT:
 * We intentionally DO NOT create a second Blink client instance here.
 * Multiple clients can race to initialize auth and inadvertently overwrite/clear
 * persisted tokens (resulting in “logged out after login” behavior).
 *
 * For public reads, use this alias; the DB module is configured public in the
 * project's security policy, so global reads work without requiring auth.
 */
export const publicDb = db

export const blink = db
export default db
