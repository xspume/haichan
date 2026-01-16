import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Palette } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function ThemesPage() {
  const navigate = useNavigate()

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3 mb-4">
            <Palette className="w-6 h-6" />
            THEMES
          </h1>
          <p className="text-muted-foreground font-mono">
            Theme customization coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
