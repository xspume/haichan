/**
 * Theme utilities for managing CSS themes
 */

const THEME_STORAGE_KEY = 'haichan-theme'
const DEFAULT_THEME = 'dark'

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
export function applyTheme(themeName: string): void {
  const root = document.documentElement

  // Remove existing theme classes
  root.classList.remove('light', 'dark')

  // Add new theme class
  root.classList.add(themeName)

  // Store preference
  storeTheme(themeName)
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
