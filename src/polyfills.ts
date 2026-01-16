import { Buffer } from 'buffer'

/**
 * Polyfills and patches for third-party libraries
 */

// Buffer polyfill for crypto libraries
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer
}

// 🔒 Enhanced error handler to suppress non-critical Radix UI Slot errors
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const originalError = console.error
  console.error = function (...args: any[]) {
    const message = String(args[0] || '')
    
    // Only suppress very specific Radix UI Slot component errors that don't affect functionality
    // These typically happen when a Slot receives multiple children or fragments
    const isRadixSlotError = 
      (message.includes('Radix') || message.includes('Slot')) && 
      (message.includes('tagName') || message.includes('toLowerCase'))
    
    if (!isRadixSlotError) {
      originalError.apply(console, args)
    }
  }
}
