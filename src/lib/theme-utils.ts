/**
 * Theme utilities for managing CSS themes
 */

const THEME_STORAGE_KEY = 'haichan-theme'
const DEFAULT_THEME = 'dark'

export interface ThemeColors {
  background: string
  foreground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  border: string
  muted: string
  mutedForeground: string
  card: string
  cardForeground: string
  [key: string]: string
}

export interface CustomTheme {
  id: string
  name: string
  description: string
  colors: ThemeColors
  fonts?: {
    heading?: string
    body?: string
  }
  backgroundImage?: string
  logoImage?: string
  buttonImage?: string
  buttonHoverImage?: string
  buttonActiveImage?: string
  cardBackgroundImage?: string
  navBackgroundImage?: string
  totalPow?: number
  userId?: string
  username?: string
}

export interface Theme {
  id: string
  name: string
  cssVariables: Record<string, string>
}

/**
 * Get the currently stored theme name
 */
export function getStoredTheme(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Store the theme preference
 */
export function storeTheme(themeName: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName)
  } catch (error) {
    console.error('[ThemeUtils] Failed to store theme:', error)
  }
}

/**
 * Apply a theme by adding/removing class from document root
 */
export function applyTheme(
  themeName: string, 
  colors?: ThemeColors, 
  backgroundImage?: string, 
  logoImage?: string, 
  fonts?: any,
  assets?: any
): void {
  const root = document.documentElement

  // Remove existing theme classes
  root.classList.remove('light', 'dark')

  // Add new theme class
  if (themeName === 'light' || themeName === 'dark') {
    root.classList.add(themeName)
  }

  // If colors are provided, apply them as CSS variables
  if (colors) {
    Object.entries(colors).forEach(([key, value]) => {
      // Convert camelCase to kebab-case for CSS variables
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      // Only apply if it's a valid hex/color string
      if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl'))) {
        root.style.setProperty(`--${cssKey}`, value)
      }
    })
  }

  // Apply visual assets if provided
  if (backgroundImage) {
    root.style.setProperty('--site-bg-image', `url(${backgroundImage})`)
  }
  if (logoImage) {
    root.style.setProperty('--site-logo-image', `url(${logoImage})`)
  }
  
  if (assets) {
    if (assets.buttonImage) root.style.setProperty('--button-image', `url(${assets.buttonImage})`)
    if (assets.buttonHoverImage) root.style.setProperty('--button-hover-image', `url(${assets.buttonHoverImage})`)
    if (assets.buttonActiveImage) root.style.setProperty('--button-active-image', `url(${assets.buttonActiveImage})`)
    if (assets.cardBackgroundImage) root.style.setProperty('--card-background-image', `url(${assets.cardBackgroundImage})`)
  }

  // Apply fonts if provided
  if (fonts) {
    if (fonts.heading) root.style.setProperty('--font-heading', fonts.heading)
    if (fonts.body) root.style.setProperty('--font-body', fonts.body)
  }

  // Store preference
  storeTheme(themeName)
}

/**
 * Get stored theme info
 */
export function getStoredThemeInfo(): string {
  return getStoredTheme()
}

/**
 * Apply the stored theme on page load
 */
export function applyStoredTheme(): void {
  const theme = getStoredTheme()
  applyTheme(theme)
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): string {
  const current = getStoredTheme()
  const newTheme = current === 'dark' ? 'light' : 'dark'
  applyTheme(newTheme)
  return newTheme
}

/**
 * Apply custom CSS variables from a theme object
 */
export function applyCustomTheme(theme: Theme): void {
  const root = document.documentElement

  // Apply each CSS variable
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  // Store theme ID
  storeTheme(theme.id)
}

/**
 * Reset to default theme
 */
export function resetTheme(): void {
  const root = document.documentElement

  // Remove any inline styles
  root.removeAttribute('style')

  // Apply default theme
  applyTheme(DEFAULT_THEME)
}
