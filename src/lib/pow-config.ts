/**
 * Dynamic Proof-of-Work Configuration
 * Allows dynamic adjustment of PoW difficulty via prefix and point mapping
 */

export interface PowLevel {
  name: string
  prefix: string
  points: number
  description: string
}

export interface PowConfig {
  levels: PowLevel[]
  currentPrefix: string
  currentPoints: number
}

/**
 * Preset PoW configurations
 * Can be mixed and matched for different difficulty levels
 */
export const POW_PRESETS = {
  STANDARD: {
    name: '21e8',
    prefix: '21e8',
    points: 15,
    description: 'Hash starting with 21e8'
  },
  HARD: {
    name: '21e8 + 1 zero',
    prefix: '21e80',
    points: 60,
    description: 'Hash starting with 21e80'
  },
  VERY_HARD: {
    name: '21e8 + 2 zeros',
    prefix: '21e800',
    points: 240,
    description: 'Hash starting with 21e800'
  },
  EXTREME: {
    name: '21e8 + 3 zeros',
    prefix: '21e8000',
    points: 960,
    description: 'Hash starting with 21e8000'
  },
  DIAMOND_1: {
    name: '21e8 + 4 zeros',
    prefix: '21e80000',
    points: 3840,
    description: 'Hash starting with 21e80000'
  }
}

/**
 * Default PoW level - uses 21e8 standard
 */
export const DEFAULT_POW_LEVEL = POW_PRESETS.STANDARD

/**
 * Get point value for a given prefix
 * Formula: 15 * 4^(extra_zeros)
 */
export function getPointsForPrefix(prefix: string): number {
  const match = prefix.match(/^21e80*$/)
  if (!match) return 0

  // Count zeros after the base prefix
  const basePrefix = '21e8'
  if (prefix === basePrefix) return 15

  // For 21e8 + trailing zeros
  if (prefix.startsWith('21e8')) {
    const extraZeros = prefix.length - 4
    return 15 * Math.pow(4, extraZeros)
  }

  return 0
}

/**
 * Get all available PoW levels
 */
export function getAllPowLevels(): PowLevel[] {
  return Object.values(POW_PRESETS)
}

/**
 * Find a PoW level by prefix
 */
export function getPowLevelByPrefix(prefix: string): PowLevel | null {
  return Object.values(POW_PRESETS).find(level => level.prefix === prefix) || null
}

/**
 * Find a PoW level by points
 */
export function getPowLevelByPoints(points: number): PowLevel | null {
  return Object.values(POW_PRESETS).find(level => level.points === points) || null
}

/**
 * Validate a custom prefix
 * Valid patterns: 21, 21e, 21e8, 21e80, 21e800, etc.
 */
export function isValidPowPrefix(prefix: string): boolean {
  return /^21e80*$/.test(prefix) && prefix.length >= 4
}

/**
 * Create a custom PoW level
 */
export function createCustomPowLevel(prefix: string, name?: string): PowLevel | null {
  if (!isValidPowPrefix(prefix)) return null

  return {
    name: name || `Custom (${prefix})`,
    prefix,
    points: getPointsForPrefix(prefix),
    description: `Hash starting with ${prefix}`
  }
}

/**
 * Get PoW level from localStorage
 */
export function getSavedPowLevel(): PowLevel {
  try {
    const saved = localStorage.getItem('pow_level')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.prefix && isValidPowPrefix(parsed.prefix)) {
        return parsed as PowLevel
      }
    }
  } catch (error) {
    console.warn('Failed to load PoW level from localStorage:', error)
  }
  return DEFAULT_POW_LEVEL
}

/**
 * Save PoW level to localStorage
 */
export function savePowLevel(level: PowLevel): void {
  try {
    localStorage.setItem('pow_level', JSON.stringify(level))
  } catch (error) {
    console.warn('Failed to save PoW level to localStorage:', error)
  }
}

/**
 * Calculate required difficulty based on thread reply count AND age
 * - 0-9 replies: Standard (21e8, 15 pts)
 * - 10-49 replies: Hard (21e80, 60 pts) - 4x harder
 * - 50-99 replies: Very Hard (21e800, 240 pts) - 16x harder
 * - 100+ replies: Extreme (21e8000, 960 pts) - 64x harder
 * 
 * DECAY RULE: multiplier = 1 + floor(thread_age_hours / 24)
 * GLOBAL MULTIPLIER: multiplied by the calculated base points
 */
export function calculateThreadDifficulty(replyCount: number, createdAt?: string, globalMultiplier = 1.0): { prefix: string, points: number } {
  let baseLevel = POW_PRESETS.STANDARD
  
  if (replyCount >= 100) baseLevel = POW_PRESETS.EXTREME
  else if (replyCount >= 50) baseLevel = POW_PRESETS.VERY_HARD
  else if (replyCount >= 10) baseLevel = POW_PRESETS.HARD
  
  let targetPoints = baseLevel.points * globalMultiplier

  if (createdAt) {
    const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
    const decayInterval = 24 // hours
    const decayMultiplier = 1 + Math.floor(Math.max(0, ageHours) / decayInterval)
    targetPoints *= decayMultiplier
  }
  
  // Find highest preset that is <= targetPoints
  const levels = getAllPowLevels()
  const level = [...levels].reverse().find(l => l.points <= targetPoints) || levels[0]
  
  return { prefix: level.prefix, points: level.points }
}

/**
 * Calculate thread lock status
 * Thread locks if > 100 posts AND total_pow < replyCount * 1000
 */
export function isThreadLocked(replyCount: number, totalPow: number | string): boolean {
  const powValue = Number(totalPow) || 0
  if (replyCount < 100) return false
  return powValue < (replyCount * 1000)
}