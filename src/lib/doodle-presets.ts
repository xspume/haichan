export interface ColorPalette {
  name: string
  colors: string[]
}

export interface TexturePreset {
  id: string
  name: string
  url: string
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    name: '90s Imageboard',
    colors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0']
  },
  {
    name: 'Vivid Cyber',
    colors: ['#0d0208', '#003b00', '#008f11', '#00ff41', '#ff003c', '#2d00f7', '#f20089', '#8900f2', '#ff8500', '#ff0000']
  },
  {
    name: 'Soft Pastel',
    colors: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#f3d1f4', '#f5e1da', '#ffffff', '#333333', '#666666']
  },
  {
    name: 'Retro Console',
    colors: ['#081820', '#346856', '#88c070', '#e0f8d0', '#000000', '#555555', '#aaaaaa', '#ffffff', '#ff0000', '#0000ff']
  }
]

export const TEXTURE_PRESETS: TexturePreset[] = [
  { id: 'noise', name: 'Grainy Noise', url: 'https://www.transparenttextures.com/patterns/asfalt-dark.png' },
  { id: 'dots', name: 'Polka Dots', url: 'https://www.transparenttextures.com/patterns/polka-dots.png' },
  { id: 'grid', name: 'Grid Paper', url: 'https://www.transparenttextures.com/patterns/graphy.png' },
  { id: 'bricks', name: 'Brick Wall', url: 'https://www.transparenttextures.com/patterns/brick-wall.png' },
  { id: 'canvas', name: 'Canvas Fiber', url: 'https://www.transparenttextures.com/patterns/canvas-orange.png' },
  { id: 'paper', name: 'Old Paper', url: 'https://www.transparenttextures.com/patterns/handmade-paper.png' }
]

export const BRUSH_PRESETS = [
  { id: 'normal', name: 'Normal Brush', icon: 'Paintbrush' },
  { id: 'marker', name: 'Marker', icon: 'PenTool' },
  { id: 'pencil', name: 'Pencil', icon: 'Pencil' },
  { id: 'airbrush', name: 'Airbrush', icon: 'Cloud' },
  { id: 'spray', name: 'Spray Paint', icon: 'Wind' },
  { id: 'calligraphy', name: 'Calligraphy', icon: 'Type' }
]
