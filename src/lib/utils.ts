import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a brand name for display
 */
export function formatBrandName(name: string): string {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

/**
 * Generate a random string of specified length
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Truncate a string to specified length with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (!str) return ''
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return '0'
  return n.toLocaleString()
}

/**
 * Get flag emoji for a country code
 */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

/**
 * Guess country code from timezone or language
 */
export function guessCountryCode(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone.includes('America/')) return 'US'
    if (timezone.includes('Europe/London')) return 'GB'
    if (timezone.includes('Europe/')) return 'EU'
    if (timezone.includes('Asia/Tokyo')) return 'JP'
    
    const lang = navigator.language
    if (lang.includes('-')) return lang.split('-')[1].toUpperCase()
    return ''
  } catch {
    return ''
  }
}
