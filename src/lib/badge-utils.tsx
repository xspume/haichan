import React from 'react'
import { Badge21e8 } from '../components/ui/badge-21e8'

/**
 * Badge utility for rendering user badges based on their attributes
 * Supports 21e8 and other future badges
 */

export interface BadgeProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Difficulty Bands and Visual Encoding
 * Trivial (<50%), Costly (50-90%), Ruinous (90-99%), Legendary (>99%)
 */
export const DIFFICULTY_BANDS = {
  TRIVIAL: { threshold: 0, name: 'Trivial', color: 'bg-muted text-muted-foreground border-muted', icon: '' },
  COSTLY: { threshold: 15, name: 'Costly', color: 'bg-muted-foreground/20 text-foreground border-muted-foreground/30', icon: '☰' },
  RUINOUS: { threshold: 240, name: 'Ruinous', color: 'bg-foreground text-background border-foreground font-black', icon: '⚡' },
  LEGENDARY: { threshold: 960, name: 'Legendary', color: 'bg-primary text-primary-foreground border-primary font-black animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.5)]', icon: '†' }
}

export function getDifficultyBand(points: number) {
  if (points >= DIFFICULTY_BANDS.LEGENDARY.threshold) return DIFFICULTY_BANDS.LEGENDARY
  if (points >= DIFFICULTY_BANDS.RUINOUS.threshold) return DIFFICULTY_BANDS.RUINOUS
  if (points >= DIFFICULTY_BANDS.COSTLY.threshold) return DIFFICULTY_BANDS.COSTLY
  return DIFFICULTY_BANDS.TRIVIAL
}

export function DifficultyBandBadge({ points, className = '' }: { points: number; className?: string }) {
  const band = getDifficultyBand(points)
  if (!band.icon && band.name === 'Trivial') return null

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] uppercase font-mono ${band.color} ${className}`}>
      {band.icon && <span>{band.icon}</span>}
      <span>{band.name}</span>
    </span>
  )
}

/**
 * Get all applicable badges for a user
 * Returns array of badge components to render
 */
export function getUserBadges(user: any): React.ReactNode[] {
  const badges: React.ReactNode[] = []

  if (!user) return badges

  // 21e8 Badge - Twitter badge holder
  if (Number(user.twitterBadgeHolder) > 0) {
    badges.push(
      <Badge21e8
        key="21e8"
        className="w-4 h-4 ml-1"
        showTooltip={true}
      />
    )
  }

  // Add future badges here as needed
  // Example:
  // if (user.diamondLevel >= 3) {
  //   badges.push(<DiamondBadge key="diamond" />)
  // }

  return badges
}

/**
 * Render all badges for a user inline
 * Used for consistent badge rendering across the app
 */
export function BadgesInline({ user, className = '' }: { user: any; className?: string }) {
  const badges = getUserBadges(user)

  if (badges.length === 0) return null

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {badges}
    </span>
  )
}

/**
 * Render username with inline badges
 * Combines username text with badge components
 */
export function UsernameWithBadges({
  user,
  username,
  className = '',
  badgeSize = 'sm'
}: {
  user: any
  username: string
  className?: string
  badgeSize?: 'sm' | 'md' | 'lg'
}) {
  const badges = getUserBadges(user)

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span>{username}</span>
      {badges.length > 0 && (
        <span className="inline-flex items-center gap-0.5 ml-1">
          {badges}
        </span>
      )}
    </span>
  )
}
