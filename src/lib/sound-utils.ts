/**
 * Sound utilities for notification and UI sounds
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Play a simple beep sound
 * @param frequency - Frequency in Hz (default 440)
 * @param duration - Duration in ms (default 100)
 * @param volume - Volume 0-1 (default 0.1)
 */
export function playBeep(frequency = 440, duration = 100, volume = 0.1): void {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gainNode.gain.value = volume

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch (error) {
    console.warn('[Sound] Failed to play beep:', error)
  }
}

/**
 * Play a notification sound
 */
export function playNotificationSound(): void {
  playBeep(880, 100, 0.1)
}

/**
 * Play a message received sound
 */
export function playMessageSound(): void {
  playBeep(660, 80, 0.08)
}

/**
 * Play a success sound
 */
export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    gainNode.gain.value = 0.1

    // Play two ascending notes
    oscillator.frequency.setValueAtTime(440, ctx.currentTime)
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.2)
  } catch (error) {
    console.warn('[Sound] Failed to play success sound:', error)
  }
}

/**
 * Play an error sound
 */
export function playErrorSound(): void {
  playBeep(220, 200, 0.1)
}

/**
 * Play a click sound
 */
export function playClickSound(): void {
  playBeep(600, 50, 0.05)
}

/**
 * Play a ping sound (for mentions, etc.)
 */
export function playPingSound(): void {
  playBeep(1000, 80, 0.08)
}

/**
 * Check if audio is supported
 */
export function isAudioSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!(window.AudioContext || (window as any).webkitAudioContext)
}
