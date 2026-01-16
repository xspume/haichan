/**
 * 3D Mode Context Provider
 * Provides global anaglyphic 3D effect state (red/cyan stereoscopic effect)
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface ThreeDModeContextType {
  is3DEnabled: boolean
  toggle3D: () => void
  enable3D: () => void
  disable3D: () => void
  intensity: number
  setIntensity: (value: number) => void
}

const ThreeDModeContext = createContext<ThreeDModeContextType | undefined>(undefined)

const STORAGE_KEY = 'haichan-3d-mode'

interface StoredSettings {
  enabled: boolean
  intensity: number
}

export function ThreeDModeProvider({ children }: { children: ReactNode }) {
  const [is3DEnabled, setIs3DEnabled] = useState(false)
  const [intensity, setIntensityState] = useState(3) // Default offset in pixels

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: StoredSettings = JSON.parse(stored)
        setIs3DEnabled(parsed.enabled ?? false)
        setIntensityState(parsed.intensity ?? 3)
      }
    } catch (error) {
      console.error('[3DMode] Failed to load settings:', error)
    }
  }, [])

  // Apply 3D mode class to document
  useEffect(() => {
    if (is3DEnabled) {
      document.documentElement.classList.add('anaglyph-3d-mode')
      document.documentElement.style.setProperty('--anaglyph-offset', `${intensity}px`)
    } else {
      document.documentElement.classList.remove('anaglyph-3d-mode')
      document.documentElement.style.removeProperty('--anaglyph-offset')
    }
  }, [is3DEnabled, intensity])

  // Save settings to localStorage
  const saveSettings = useCallback((enabled: boolean, intensityVal: number) => {
    try {
      const settings: StoredSettings = { enabled, intensity: intensityVal }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('[3DMode] Failed to save settings:', error)
    }
  }, [])

  const toggle3D = useCallback(() => {
    setIs3DEnabled(prev => {
      const newValue = !prev
      saveSettings(newValue, intensity)
      return newValue
    })
  }, [intensity, saveSettings])

  const enable3D = useCallback(() => {
    setIs3DEnabled(true)
    saveSettings(true, intensity)
  }, [intensity, saveSettings])

  const disable3D = useCallback(() => {
    setIs3DEnabled(false)
    saveSettings(false, intensity)
  }, [intensity, saveSettings])

  const setIntensity = useCallback((value: number) => {
    const clampedValue = Math.max(1, Math.min(10, value))
    setIntensityState(clampedValue)
    saveSettings(is3DEnabled, clampedValue)
  }, [is3DEnabled, saveSettings])

  return (
    <ThreeDModeContext.Provider
      value={{
        is3DEnabled,
        toggle3D,
        enable3D,
        disable3D,
        intensity,
        setIntensity,
      }}
    >
      {children}
    </ThreeDModeContext.Provider>
  )
}

export function use3DMode(): ThreeDModeContextType {
  const context = useContext(ThreeDModeContext)
  if (!context) {
    throw new Error('use3DMode must be used within ThreeDModeProvider')
  }
  return context
}

export default ThreeDModeContext
