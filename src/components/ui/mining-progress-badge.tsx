import { cn } from "@/lib/utils"

interface MiningProgressBadgeProps {
  points?: number
  hashRate?: number
  className?: string
  showHashRate?: boolean
}

export function MiningProgressBadge({
  points = 0,
  hashRate = 0,
  className,
  showHashRate = true
}: MiningProgressBadgeProps) {
  const formatHashRate = (rate: number) => {
    if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}MH/s`
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}KH/s`
    return `${rate.toFixed(0)}H/s`
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-xs font-mono",
      className
    )}>
      <span className="text-green-500">{points} pts</span>
      {showHashRate && hashRate > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">{formatHashRate(hashRate)}</span>
        </>
      )}
    </div>
  )
}
