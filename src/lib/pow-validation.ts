import { MiningManager } from './mining/MiningManager'
import { invokeFunction } from './functions-utils'

export interface PoWValidationData {
  challenge: string
  nonce: string
  hash: string
  prefix: string
  points: number
  trailingZeros: number
}

/**
 * Get PoW validation data from the mining manager
 */
export function getPoWValidationData(): PoWValidationData | null {
  const manager = MiningManager.getInstance()
  const powResult = manager.getLastPoWResult()
  
  if (!powResult) {
    return null
  }

  const { result, challenge, prefix } = powResult

  return {
    challenge,
    nonce: result.nonce,
    hash: result.hash,
    prefix,
    points: result.points,
    trailingZeros: result.trailingZeros
  }
}

/**
 * Check if valid PoW is currently available
 */
export function isValidPoWAvailable(minPrefix: string = '21e8', minPoints: number = 15): boolean {
  const powData = getPoWValidationData()
  if (!powData) return false
  
  if (!powData.hash.startsWith(minPrefix)) return false
  
  return powData.points >= minPoints
}

/**
 * Clear the stored PoW validation data after use
 */
export function clearPoWValidationData(): void {
  const manager = MiningManager.getInstance()
  manager.clearLastPoWResult()
}

/**
 * Fetch post number with optional PoW validation
 */
export async function fetchPostNumberWithPoW(includePoW: boolean = true): Promise<number> {
  const requestBody: { powData?: PoWValidationData } = {}
  
  if (includePoW) {
    const powData = getPoWValidationData()
    if (powData) {
      const meetsPrefix = powData.hash.startsWith('21e8')
      const meetsPoints = powData.points >= 15
      const meetsRequirements = meetsPrefix && meetsPoints
      
      if (meetsRequirements) {
        requestBody.powData = powData
        console.log(`✓ Including valid PoW validation data`)
      } else {
        console.warn('⚠ PoW data does not meet minimum requirements (21e8, 15+ points)')
      }
    }
  }

  const { data, error } = await invokeFunction<{ postNumber: number }>('increment-post-number', {
    body: requestBody
  })

  if (error) {
    console.error('❌ Edge function error:', error)
    throw new Error(error.message || 'Failed to get post number')
  }

  if (!data || !data.postNumber) {
    throw new Error('Invalid response from edge function')
  }

  // Clear PoW data after successful use
  if (includePoW) {
    clearPoWValidationData()
  }

  return data.postNumber
}
