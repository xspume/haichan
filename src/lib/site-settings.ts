import db from './db-client'

export interface SiteSettings {
  id?: string
  siteName: string
  siteDescription: string
  maintenanceMode: boolean
  registrationOpen: boolean
  inviteRequired: boolean
  isInviteOnly?: boolean
  difficultyMultiplier?: number
  diamondBoost?: number
  talkyPersonality?: string
  pruningThresholdDays?: number
  motd?: string
  minPowForPost: number
  minPowForThread: number
  minPowForBoard: number
  maxBoardsPerUser: number
  maxThreadsPerBoard: number
  threadExpireDays: number
  globalAnnouncement: string
  globalAnnouncementEnabled: boolean
  createdAt?: string
  updatedAt?: string
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Haichan',
  siteDescription: 'PoW-mediated imageboard',
  maintenanceMode: false,
  registrationOpen: true,
  inviteRequired: true,
  isInviteOnly: true,
  difficultyMultiplier: 1.0,
  diamondBoost: 1.0,
  talkyPersonality: 'helpful',
  pruningThresholdDays: 30,
  motd: '',
  minPowForPost: 15,
  minPowForThread: 15,
  minPowForBoard: 240,
  maxBoardsPerUser: 3,
  maxThreadsPerBoard: 100,
  threadExpireDays: 7,
  globalAnnouncement: '',
  globalAnnouncementEnabled: false
}

let cachedSettings: SiteSettings | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get site settings with caching
 * @param forceRefresh - Force refresh from database
 */
export async function getSiteSettings(forceRefresh = false): Promise<SiteSettings> {
  const now = Date.now()

  // Return cached if valid and not forced refresh
  if (!forceRefresh && cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings
  }

  try {
    const settings = await db.db.siteSettings.list({ limit: 1 })

    if (settings && settings.length > 0) {
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...settings[0]
      }
    } else {
      // No settings in DB, return defaults
      cachedSettings = DEFAULT_SETTINGS
    }

    cacheTimestamp = now
    return cachedSettings
  } catch (error) {
    console.error('[SiteSettings] Failed to load settings:', error)
    // Return cached or defaults on error
    return cachedSettings || DEFAULT_SETTINGS
  }
}

/**
 * Update site settings
 * @param updates - Partial settings to update
 */
export async function updateSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
  try {
    // Get current settings to find ID
    const current = await db.db.siteSettings.list({ limit: 1 })

    let updated: SiteSettings

    if (current && current.length > 0) {
      // Update existing
      updated = await db.db.siteSettings.update(current[0].id, updates)
    } else {
      // Create new
      updated = await db.db.siteSettings.create({
        ...DEFAULT_SETTINGS,
        ...updates
      })
    }

    // Update cache
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...updated
    }
    cacheTimestamp = Date.now()

    return cachedSettings
  } catch (error) {
    console.error('[SiteSettings] Failed to update settings:', error)
    throw error
  }
}

/**
 * Clear the settings cache
 */
export function clearSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}
