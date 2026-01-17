export type TimeOfDay = 'auto' | 'dawn' | 'day' | 'dusk' | 'night'
export type GrainStyle = 'none' | 'film' | 'crt' | 'dust'
export type Lighting = 'soft' | 'hard' | 'neon' | 'moon'
export type Palette = 'paper' | 'phosphor' | 'amber' | 'ink'
export type ShadeModel = 'flat' | 'lambert' | 'noir'

export interface VisualMatrix {
  timeOfDay: TimeOfDay
  lighting: Lighting
  grain: GrainStyle
  palette: Palette
  shade: ShadeModel
  textureIntensity: number // 0..1
  grainIntensity: number // 0..1
  scanlines: boolean
  vignette: boolean
  bloom: boolean
}

export const DEFAULT_VISUAL_MATRIX: VisualMatrix = {
  timeOfDay: 'auto',
  lighting: 'soft',
  grain: 'film',
  palette: 'paper',
  shade: 'lambert',
  textureIntensity: 0.65,
  grainIntensity: 0.28,
  scanlines: true,
  vignette: true,
  bloom: false
}

export function buildAiTexturePrompt(matrix: VisualMatrix, extra: string) {
  const paletteHint: Record<Palette, string> = {
    paper: 'black ink on warm paper, subtle halftone, 90s zine texture',
    phosphor: 'green phosphor glow, terminal raster, cyber scan texture',
    amber: 'amber CRT glow, sepia electron beam, analog warmth',
    ink: 'high contrast ink wash, scratchy pencil, xerox noise'
  }

  const todHint: Record<TimeOfDay, string> = {
    auto: 'time-of-day cycle lighting',
    dawn: 'dawn lighting, cool shadows, soft haze',
    day: 'daylight, crisp shadows, neutral sky bounce',
    dusk: 'dusk lighting, long shadows, warm rim light',
    night: 'night lighting, moonlit, deep shadows'
  }

  const lightHint: Record<Lighting, string> = {
    soft: 'soft studio lighting, diffuse bounce',
    hard: 'hard spotlight, sharp cast shadows',
    neon: 'neon signage lighting, colored rim glows',
    moon: 'moonlight, high contrast, specular highlights'
  }

  const grainHint: Record<GrainStyle, string> = {
    none: 'clean texture, minimal grain',
    film: 'film grain, subtle dust, analog noise',
    crt: 'CRT raster, scanlines, slight chromatic bleed',
    dust: 'dust specks, scratches, xerox artifacts'
  }

  const shadeHint: Record<ShadeModel, string> = {
    flat: 'flat shading, graphic shapes',
    lambert: 'soft shading, volumetric lighting cues',
    noir: 'noir shading, extreme contrast, dramatic shadows'
  }

  const user = extra.trim()

  return [
    'Seamless tileable texture for a generative canvas background.',
    paletteHint[matrix.palette] + '.',
    todHint[matrix.timeOfDay] + '.',
    lightHint[matrix.lighting] + '.',
    grainHint[matrix.grain] + '.',
    shadeHint[matrix.shade] + '.',
    'Abstract but readable. No text, no logos, no faces.',
    user ? `Theme: ${user}` : ''
  ]
    .filter(Boolean)
    .join(' ')
}
