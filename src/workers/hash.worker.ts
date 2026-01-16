// SHA-256 using Web Crypto API (async) - matches server-side implementation
async function sha256Async(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomNonce(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

function calculatePoints(hash: string, targetPrefix: string): number {
  if (!hash.startsWith(targetPrefix)) return 0
  
  // Base points for the minimum required prefix (21e8)
  const basePoints = 15
  
  // Bonus for extra zeros after the 21e8 prefix
  let extraZeros = 0
  const basePrefix = '21e8'
  if (hash.startsWith(basePrefix)) {
    for (let i = 4; i < hash.length && extraZeros < 60; i++) {
      if (hash[i] === '0') {
        extraZeros++
      } else {
        break
      }
    }
  }
  
  return Math.round(basePoints * Math.pow(4, extraZeros))
}

function countTrailingZeros(hash: string, targetPrefix: string): number {
  if (!hash.startsWith(targetPrefix)) return 0
  
  let count = 0
  const startIdx = targetPrefix.length
  for (let i = startIdx; i < hash.length && count < 60; i++) {
    if (hash[i] === '0') {
      count++
    } else {
      break
    }
  }
  
  return count
}

// Worker message handler and hash rate tracking
let mining = false
let challenge = ''
let mineStartTime = 0
let hashesInWindow = 0
let windowStartTime = 0
let currentHashRate = 0
let currentPrefix = '21e8'

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data

  switch (type) {
    case 'start':
      mining = true
      challenge = data.challenge
      currentPrefix = data.prefix || '21e8'
      mine(data.targetPoints || 15)
      break
    
    case 'stop':
      mining = false
      break
    
    case 'hash':
      sha256Async(data.input).then(hash => {
        self.postMessage({ type: 'hash_result', hash })
      })
      break
  }
}

async function mine(targetPoints: number) {
  let attempts = 0
  let bestHash = ''
  let bestNonce = ''
  let bestPoints = 0
  mineStartTime = Date.now()
  hashesInWindow = 0
  windowStartTime = Date.now()
  currentHashRate = 0
  let lastProgressTime = Date.now()

  const mineStep = async () => {
    // Check if mining was stopped
    if (!mining) {
      const totalTime = Date.now() - mineStartTime
      const finalHashRate = totalTime > 0 ? Math.round((attempts * 1000) / totalTime) : 0
      
      console.log('[Worker] Mining stopped - sending completion', {
        hash: bestHash.substring(0, 16) + '...',
        points: bestPoints,
        attempts
      })
      
      self.postMessage({
        type: 'complete',
        data: {
          hash: bestHash,
          nonce: bestNonce,
          points: bestPoints,
          trailingZeros: bestPoints > 0 ? countTrailingZeros(bestHash, currentPrefix) : 0,
          attempts,
          hashRate: finalHashRate,
          challenge: challenge
        }
      })
      return
    }

    // Process hashes in batches (smaller for async)
    let batchComplete = false
    for (let i = 0; i < 500 && !batchComplete && mining; i++) {
      const nonce = randomNonce()
      const input = challenge + nonce
      const hash = await sha256Async(input)
      const points = calculatePoints(hash, currentPrefix)
      const trailingZeros = countTrailingZeros(hash, currentPrefix)

      attempts++
      hashesInWindow++

      // Update best result if this hash is better
      if (points > bestPoints) {
        bestPoints = points
        bestHash = hash
        bestNonce = nonce

        console.log(`[Worker] New best: ${points} points (${attempts} attempts)`, hash.substring(0, 16) + '...')

        // Check if we've reached the target
        if (points >= targetPoints) {
          console.log('[Worker] Target reached! Stopping mining...', {
            points,
            targetPoints,
            hash: hash.substring(0, 16) + '...'
          })
          mining = false
          batchComplete = true
          break
        }
      }
    }

    // If we hit the target, don't schedule another iteration
    if (!mining) {
      mineStep() // Send final completion message
      return
    }

    // Update rolling hash rate every 500ms
    const now = Date.now()
    const windowElapsed = now - windowStartTime
    if (windowElapsed >= 500) {
      currentHashRate = Math.round((hashesInWindow * 1000) / windowElapsed)
      hashesInWindow = 0
      windowStartTime = now
    }

    // Send progress update periodically (every 200ms) with granular info
    if (now - lastProgressTime >= 200) {
      self.postMessage({
        type: 'progress',
        data: {
          hash: bestHash,
          nonce: bestNonce,
          points: bestPoints,
          trailingZeros: bestPoints > 0 ? countTrailingZeros(bestHash, currentPrefix) : 0,
          attempts,
          hashRate: currentHashRate,
          challenge: challenge
        }
      })
      lastProgressTime = now
    }

    // Schedule next batch with immediate callback
    setTimeout(mineStep, 0)
  }

  // Start mining immediately
  console.log('[Worker] Starting mining with Web Crypto SHA-256. TargetPoints:', targetPoints, 'prefix:', currentPrefix)
  mineStep()
}
