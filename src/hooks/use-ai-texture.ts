import { useCallback, useMemo, useRef, useState } from 'react'
import db from '../lib/db-client'
import type { VisualMatrix } from '../lib/visual-matrix'
import { buildAiTexturePrompt } from '../lib/visual-matrix'

type TextureState = {
  url: string | null
  isLoading: boolean
  error: string | null
}

export function useAiTexture() {
  const cacheRef = useRef<Map<string, string>>(new Map())
  const [state, setState] = useState<TextureState>({ url: null, isLoading: false, error: null })

  const getCacheKey = useCallback((matrix: VisualMatrix, extra: string) => {
    return JSON.stringify({ matrix, extra: extra.trim() })
  }, [])

  const generate = useCallback(async (matrix: VisualMatrix, extra: string) => {
    const key = getCacheKey(matrix, extra)
    const cached = cacheRef.current.get(key)
    if (cached) {
      setState({ url: cached, isLoading: false, error: null })
      return cached
    }

    setState(s => ({ ...s, isLoading: true, error: null }))

    try {
      const prompt = buildAiTexturePrompt(matrix, extra)
      const res = await db.ai.generateImage({
        prompt,
        n: 1,
        size: '1024x1024'
      })

      const url = res.data?.[0]?.url
      if (!url) throw new Error('AI did not return an image URL')

      cacheRef.current.set(key, url)
      setState({ url, isLoading: false, error: null })
      return url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate texture'
      setState(s => ({ ...s, isLoading: false, error: msg }))
      return null
    }
  }, [getCacheKey])

  return useMemo(() => ({ ...state, generate }), [state, generate])
}
