declare module '@blinkdotnew/sdk' {
  // Minimal shims for build-time only. Use the real SDK at runtime.
  export interface BlinkUser {
    id: string
    username: string
    email?: string
    displayName?: string
    [key: string]: any
  }

  export interface AuthState {
    user: BlinkUser | null
    isLoading: boolean
    isAuthenticated: boolean
    tokens: any
  }

  export function createClient(config: any): {
    auth: any
    db: any
    storage: {
      upload: (file: any, path: string, options?: any) => Promise<{ publicUrl: string }>
      download: (path: string) => Promise<any>
      remove: (path: string) => Promise<any>
    }
    ai: {
      generateImage: (options: any) => Promise<{ data: Array<{ url: string }> }>
      [key: string]: any
    }
    realtime: any
    functions: any
  }
  export type RealtimeChannel = any
  export type BlinkDatabase = any
  export const db: any
}

declare module 'bitcoinjs-lib'
declare module 'tiny-secp256k1'
declare module 'ecpair'
declare module 'vitest'
declare module 'elliptic'
