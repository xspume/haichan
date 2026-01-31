/**
 * Rich Text Processing Utility
 * Converts plain text to rich content with:
 * - YouTube embeds
 * - Clickable hyperlinks
 * - Line breaks preserved
 */

import { sanitizeText } from './sanitization'

export interface RichTextOptions {
  allowYouTube?: boolean
  allowHyperlinks?: boolean
  openLinksInNewTab?: boolean
}

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
const URL_REGEX = /(https?:\/\/[^\s]+)/g
const QUOTE_REGEX = />>(\d+)/g

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

/**
 * Process text into rich content with embeds and links
 */
export function processRichText(
  text: string,
  options: RichTextOptions = {}
): React.ReactNode {
  const {
    allowYouTube = true,
    allowHyperlinks = true,
    openLinksInNewTab = true
  } = options

  if (!text) return null

  // Sanitize input text to strip any HTML
  const sanitizedText = sanitizeText(text)

  // Split text into lines to preserve line breaks
  const lines = sanitizedText.split('\n')
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        if (line.trim() === '') {
          return <br key={`br-${lineIndex}`} />
        }

        // Lines starting with > (but not >>) get redtext styling
        const isRedtext = line.trim().startsWith('>') && !line.trim().startsWith('>>')
        
        // Final elements for this specific line
        const lineElements: React.ReactNode[] = []
        
        // 1. First, handle YouTube embeds (these get their own blocks)
        let remainingText = line
        let lastIndex = 0
        
        if (allowYouTube) {
          const youtubeMatches = Array.from(line.matchAll(YOUTUBE_REGEX))
          
          if (youtubeMatches.length > 0) {
            youtubeMatches.forEach((match, matchIndex) => {
              const [fullMatch, videoId] = match
              const startIndex = match.index!
              
              // Process text before the YouTube link for URLs and Quotes
              const beforeText = line.substring(lastIndex, startIndex)
              if (beforeText) {
                lineElements.push(...processInlineElements(beforeText, lineIndex, `yt-pre-${matchIndex}`, options, isRedtext))
              }
              
              // Add YouTube embed block
              lineElements.push(
                <div key={`youtube-${lineIndex}-${matchIndex}`} className="my-4 clear-both">
                  <div className="aspect-video border-2 border-black bg-black">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )
              
              lastIndex = startIndex + fullMatch.length
            })
            
            remainingText = line.substring(lastIndex)
          }
        }
        
        // 2. Process whatever is left in the line (or the whole line if no YT)
        if (remainingText) {
          lineElements.push(...processInlineElements(remainingText, lineIndex, 'final', options, isRedtext))
        }

        return (
          <div key={`line-${lineIndex}`} className="min-h-[1.2em]">
            {lineElements}
          </div>
        )
      })}
    </>
  )
}

/**
 * Internal helper to process URLs and Quotes within a text segment
 */
function processInlineElements(
  text: string,
  lineIndex: number,
  segmentKey: string,
  options: RichTextOptions,
  isRedtext: boolean
): React.ReactNode[] {
  const { allowHyperlinks = true, openLinksInNewTab = true } = options
  const elements: React.ReactNode[] = []
  
  // Create a combined regex for URLs and Quotes to process them in sequence
  // We use capturing groups to distinguish between them
  const combinedRegex = new RegExp(
    `${allowHyperlinks ? `(${URL_REGEX.source})` : ''}${allowHyperlinks ? '|' : ''}(${QUOTE_REGEX.source})`,
    'g'
  )
  
  let lastIndex = 0
  const matches = Array.from(text.matchAll(combinedRegex))
  
  matches.forEach((match, matchIndex) => {
    const fullMatch = match[0]
    const urlMatch = match[1]
    const quoteMatch = match[2]
    const quoteId = match[3] // The (\d+) from QUOTE_REGEX
    const startIndex = match.index!
    
    // Add plain text before match
    if (startIndex > lastIndex) {
      const plainText = text.substring(lastIndex, startIndex)
      elements.push(
        <span key={`text-${lineIndex}-${segmentKey}-${matchIndex}`} className={isRedtext ? "redtext font-mono" : ""}>
          {plainText}
        </span>
      )
    }
    
    // Add matched element
    if (urlMatch) {
      elements.push(
        <a
          key={`link-${lineIndex}-${segmentKey}-${matchIndex}`}
          href={urlMatch}
          target={openLinksInNewTab ? '_blank' : undefined}
          rel={openLinksInNewTab ? 'noopener noreferrer' : undefined}
          className="underline hover:no-underline font-bold text-blue-400 break-all"
        >
          {urlMatch}
        </a>
      )
    } else if (quoteMatch) {
      elements.push(
        <a
          key={`quote-${lineIndex}-${segmentKey}-${matchIndex}`}
          href={`#p${quoteId}`}
          data-post-id={quoteId}
          className="quotelink hover:underline cursor-pointer font-bold"
        >
          {quoteMatch}
        </a>
      )
    }
    
    lastIndex = startIndex + fullMatch.length
  })
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    const remainingPlainText = text.substring(lastIndex)
    elements.push(
      <span key={`text-end-${lineIndex}-${segmentKey}`} className={isRedtext ? "redtext font-mono" : ""}>
        {remainingPlainText}
      </span>
    )
  }
  
  return elements
}
/**
 * Get available font options for blog theming
 */
export const BLOG_FONT_OPTIONS = [
  // MONOSPACE FONTS
  { value: 'mono', label: 'Courier (Default)', family: "'Courier New', Courier, monospace" },
  { value: 'courier-prime', label: 'Courier Prime', family: "'Courier Prime', monospace" },
  { value: 'fira-code', label: 'Fira Code', family: "'Fira Code', monospace" },
  { value: 'ibm-plex', label: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
  { value: 'jetbrains', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { value: 'source-code', label: 'Source Code Pro', family: "'Source Code Pro', monospace" },
  { value: 'space-mono', label: 'Space Mono', family: "'Space Mono', monospace" },
  { value: 'vt323', label: 'VT323 (Retro)', family: "'VT323', monospace" },
  { value: 'inconsolata', label: 'Inconsolata', family: "'Inconsolata', monospace" },
  { value: 'roboto-mono', label: 'Roboto Mono', family: "'Roboto Mono', monospace" },
  { value: 'proggy', label: 'Proggy Vector', family: "'Proggy Vector', monospace" },
  { value: 'hack', label: 'Hack', family: "'Hack', monospace" },
  { value: 'overpass-mono', label: 'Overpass Mono', family: "'Overpass Mono', monospace" },
  { value: 'pt-mono', label: 'PT Mono', family: "'PT Mono', monospace" },
  { value: 'andale-mono', label: 'Andale Mono', family: "'Andale Mono', monospace" },
  
  // SANS-SERIF FONTS
  { value: 'noto-sans', label: 'Noto Sans', family: "'Noto Sans', sans-serif" },
  { value: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif" },
  { value: 'open-sans', label: 'Open Sans', family: "'Open Sans', sans-serif" },
  { value: 'inter', label: 'Inter', family: "'Inter', sans-serif" },
  { value: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { value: 'ubuntu', label: 'Ubuntu', family: "'Ubuntu', sans-serif" },
  { value: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { value: 'work-sans', label: 'Work Sans', family: "'Work Sans', sans-serif" },
  { value: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif" },
  { value: 'oxygen', label: 'Oxygen', family: "'Oxygen', sans-serif" },
  { value: 'source-sans', label: 'Source Sans Pro', family: "'Source Sans Pro', sans-serif" },
  { value: 'lato', label: 'Lato', family: "'Lato', sans-serif" },
  { value: 'quicksand', label: 'Quicksand', family: "'Quicksand', sans-serif" },
  { value: 'dosis', label: 'Dosis', family: "'Dosis', sans-serif" },
  { value: 'muli', label: 'Muli', family: "'Muli', sans-serif" },
  { value: 'nunito', label: 'Nunito', family: "'Nunito', sans-serif" },
  { value: 'varela-round', label: 'Varela Round', family: "'Varela Round', sans-serif" },
  
  // SERIF FONTS
  { value: 'roboto-slab', label: 'Roboto Slab', family: "'Roboto Slab', serif" },
  { value: 'crimson', label: 'Crimson Text', family: "'Crimson Text', serif" },
  { value: 'lora', label: 'Lora', family: "'Lora', serif" },
  { value: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif" },
  { value: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'abril', label: 'Abril Fatface', family: "'Abril Fatface', serif" },
  { value: 'bodoni', label: 'Bodoni Moda', family: "'Bodoni Moda', serif" },
  { value: 'cinzel', label: 'Cinzel', family: "'Cinzel', serif" },
  { value: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { value: 'eb-garamond', label: 'EB Garamond', family: "'EB Garamond', serif" },
  { value: 'gentium', label: 'Gentium Book Basic', family: "'Gentium Book Basic', serif" },
  { value: 'libre-baskerville', label: 'Libre Baskerville', family: "'Libre Baskerville', serif" },
  { value: 'noto-serif', label: 'Noto Serif', family: "'Noto Serif', serif" },
  { value: 'pt-serif', label: 'PT Serif', family: "'PT Serif', serif" },
  { value: 'source-serif', label: 'Source Serif Pro', family: "'Source Serif Pro', serif" },
  { value: 'spectral', label: 'Spectral', family: "'Spectral', serif" },
  
  // DISPLAY / DECORATIVE FONTS
  { value: 'comic', label: 'Comic Neue', family: "'Comic Neue', cursive" },
  { value: 'pacifico', label: 'Pacifico', family: "'Pacifico', cursive" },
  { value: 'righteous', label: 'Righteous', family: "'Righteous', display" },
  { value: 'fredoka-one', label: 'Fredoka One', family: "'Fredoka One', sans-serif" },
  { value: 'russo-one', label: 'Russo One', family: "'Russo One', sans-serif" },
  { value: 'permanent-marker', label: 'Permanent Marker', family: "'Permanent Marker', cursive" },
  { value: 'bangers', label: 'Bangers', family: "'Bangers', cursive" },
  { value: 'indie-flower', label: 'Indie Flower', family: "'Indie Flower', cursive" },
  { value: 'architects-daughter', label: 'Architects Daughter', family: "'Architects Daughter', cursive" },
  { value: 'amatic-sc', label: 'Amatic SC', family: "'Amatic SC', cursive" },
  { value: 'caveat', label: 'Caveat', family: "'Caveat', cursive" },
  { value: 'fredoka', label: 'Fredoka', family: "'Fredoka', sans-serif" },
  { value: 'karla', label: 'Karla', family: "'Karla', sans-serif" },
  { value: 'press-start', label: 'Press Start 2P', family: "'Press Start 2P', cursive" },
  { value: 'viga', label: 'Viga', family: "'Viga', sans-serif" }
] as const

export function getFontFamily(fontValue: string): string {
  const font = BLOG_FONT_OPTIONS.find(f => f.value === fontValue)
  return font?.family || "'Courier New', Courier, monospace"
}