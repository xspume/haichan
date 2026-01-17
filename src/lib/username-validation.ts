import { MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH } from './constants'

export interface ValidationResult {
  valid: boolean
  error?: string
  message?: string
}

/**
 * Validate a username
 * @param username - The username to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { valid: false, error: 'Username is required' }
  }

  const trimmed = username.trim()

  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters`
    }
  }

  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      error: `Username must be at most ${MAX_USERNAME_LENGTH} characters`
    }
  }

  // Only allow alphanumeric characters, underscores, and hyphens
  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens'
    }
  }

  // Cannot start with a number
  if (/^[0-9]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username cannot start with a number'
    }
  }

  // Reserved usernames
  const reserved = ['admin', 'root', 'system', 'moderator', 'mod', 'support', 'help', 'haichan']
  if (reserved.includes(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: 'This username is reserved'
    }
  }

  return { valid: true }
}

/**
 * Sanitize a username by removing invalid characters
 * @param username - The username to sanitize
 * @returns Sanitized username
 */
export function sanitizeUsername(username: string): string {
  if (!username) return ''

  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, MAX_USERNAME_LENGTH)
}
