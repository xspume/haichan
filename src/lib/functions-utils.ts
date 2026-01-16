import db, { PROJECT_ID } from './db-client'

type InvokeResult<T> = { data: T | null; error: any }

function normalizeInvokeError(err: any) {
  const name = err?.name || err?.value?.name
  const message = err?.message || err?.value?.message || String(err)
  const code = err?.code || err?.value?.code
  const status = err?.status || err?.value?.status
  
  // Detect various network failure indicators
  const isNetwork = 
    name === 'BlinkNetworkError' || 
    code === 'NETWORK_ERROR' || 
    status === 0 || 
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('network error') ||
    message.toLowerCase().includes('load failed')

  return {
    name,
    message,
    code,
    status,
    isNetwork,
    retryAfterMs: isNetwork ? 30_000 : undefined,
    original: err,
  }
}

async function invokeViaFetch<T = any>(
  functionName: string,
  options: { body?: any } = {}
): Promise<InvokeResult<T>> {
  try {
    // Get token if user is authenticated
    // Note: getValidToken might return null if not authenticated
    let token: string | null = null
    try {
      const user = await db.auth.me()
      if (user) {
        token = await db.auth.getValidToken()
      }
    } catch {
      // Ignore auth errors
    }

    // Extract project prefix (short ID) from full project ID
    // Example: "haichan-pow-imageboard-7e3gh26u" -> "7e3gh26u"
    const projectPrefix = PROJECT_ID.includes('-') 
      ? PROJECT_ID.split('-').pop() 
      : PROJECT_ID

    const functionUrl = `https://${projectPrefix}--${functionName}.functions.blink.new`

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(options.body || {}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorJson = JSON.parse(errorText)
        return { data: null, error: errorJson }
      } catch {
        return { data: null, error: { message: errorText } }
      }
    }

    const text = await response.text()
    if (!text) {
      return { data: {} as T, error: null }
    }

    const data = JSON.parse(text)
    return { data, error: null }
  } catch (err: any) {
    const normalized = normalizeInvokeError(err)
    return { data: null, error: normalized }
  }
}

export async function invokeFunction<T = any>(
  functionName: string,
  options: { body?: any } = {}
): Promise<InvokeResult<T>> {

  // Use SDK if available
  if (db.functions) {
    try {
      console.log(`[functions-utils] Invoking ${functionName} via SDK...`)
      const result = await db.functions.invoke(functionName, options)
      if (result.error) {
        // Avoid spamming console with CORS/network errors (browser surfaces these as "NetworkError")
        const normalized = normalizeInvokeError(result.error)
        if (normalized.isNetwork) {
          console.warn(`[functions-utils] Network error invoking ${functionName}:`, normalized.message)
          // SDK invocation can fail on some hosts due to networking/CORS; direct function URL is more reliable.
          const fetchResult = await invokeViaFetch<T>(functionName, options)
          if (!fetchResult.error) return fetchResult
        } else {
          console.error(`[functions-utils] SDK invocation error for ${functionName}:`, result.error)
        }
      }
      return result
    } catch (err) {
      const normalized = normalizeInvokeError(err)
      if (normalized.isNetwork) {
        console.warn(`[functions-utils] Network exception invoking ${functionName}:`, normalized.message)
        const fetchResult = await invokeViaFetch<T>(functionName, options)
        if (!fetchResult.error) return fetchResult
      } else {
        console.error(`[functions-utils] SDK invocation exception for ${functionName}:`, err)
      }
      // SDK might throw errors, wrap them
      return { data: null, error: normalized }
    }
  }

  console.warn(`[functions-utils] Blink functions not available, falling back to fetch for ${functionName}`)
  const fetchResult = await invokeViaFetch<T>(functionName, options)
  if (fetchResult.error) {
    const normalized = normalizeInvokeError(fetchResult.error)
    if (normalized.isNetwork) {
      console.warn(`[functions-utils] Network error invoking ${functionName} (fetch fallback):`, normalized.message)
    } else {
      console.error(`[functions-utils] Error invoking ${functionName} (fetch fallback):`, fetchResult.error)
    }
  }
  return fetchResult
}