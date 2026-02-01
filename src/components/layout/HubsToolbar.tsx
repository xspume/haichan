import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, BookOpen, Zap, Palette, Image, TrendingUp, Scroll } from 'lucide-react'
import { cn } from '../../lib/utils'

export function HubsToolbar() {
  const location = useLocation()
  
  const hubs = [
    { to: "/chat", icon: <MessageSquare className="w-3 h-3" />, label: "Chat" },
    { to: "/blogs", icon: <BookOpen className="w-3 h-3" />, label: "Blogs" },
    { to: "/games", icon: <Zap className="w-3 h-3" />, label: "Games" },
    { to: "/canvas", icon: <Palette className="w-3 h-3" />, label: "Canvas" },
    { to: "/images", icon: <Image className="w-3 h-3" />, label: "Images" },
    { to: "/work-ledger", icon: <TrendingUp className="w-3 h-3" />, label: "Ledger" },
    { to: "/thesis", icon: <Scroll className="w-3 h-3" />, label: "Thesis" },
  ]

  return (
    <div className="flex items-center gap-2 text-[11px] font-sans border-l-2 border-primary/20 ml-2 pl-3">
      {hubs.map((hub) => (
        <Link
          key={hub.to}
          to={hub.to}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 transition-all uppercase font-black tracking-widest text-[9px]",
            location.pathname === hub.to 
              ? "bg-primary text-background shadow-sm" 
              : "text-primary hover:bg-primary/10"
          )}
        >
          {hub.icon}
          <span className="hidden xl:inline">{hub.label}</span>
        </Link>
      ))}
    </div>
  )
}
