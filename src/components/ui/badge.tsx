import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border-2 border-primary/40 px-1.5 py-0.5 text-[9px] font-black font-sans transition-colors focus:outline-none focus:ring-0 uppercase tracking-widest shadow-sm",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-background border-primary hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/80",
        outline: "bg-transparent text-primary border-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
