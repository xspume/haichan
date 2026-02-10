import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Pickaxe, Zap, Trophy } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'

export function MinePage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()

  return (
    <div className="bg-background text-foreground min-h-screen font-sans">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-black text-[10px] mb-6 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>

        <div className="border-4 border-primary bg-card text-card-foreground p-6 mb-6 shadow-3d-sm">
          <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-primary">
            <Pickaxe className="w-6 h-6 animate-pulse" />
            Mining Dashboard
          </h1>
          <p className="text-muted-foreground font-bold text-[11px] mt-2 uppercase tracking-widest opacity-70">
            Verify actions to earn prestige and unlock features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-2 border-primary shadow-3d-sm bg-background">
            <CardHeader className="pb-2 bg-primary/5">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <Trophy className="w-3 h-3" />
                Total Work
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-black text-primary tracking-tighter">
                {(dbUser?.totalPowPoints || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary shadow-3d-sm bg-background">
            <CardHeader className="pb-2 bg-primary/5">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <Zap className="w-3 h-3" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-lg font-black uppercase tracking-widest text-primary animate-pulse">
                ACTIVE
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary shadow-3d-sm bg-background">
            <CardHeader className="pb-2 bg-primary/5">
              <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <Pickaxe className="w-3 h-3" />
                Prefix
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-lg font-black uppercase tracking-widest">
                21e8
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="border-4 border-primary bg-card text-card-foreground p-6 shadow-3d-sm">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-primary">PoW Formula</h2>
          <div className="text-[11px] space-y-4">
            <p className="font-bold opacity-80 uppercase tracking-widest">Points = 15 x 4^(trailing zeros)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 border-2 border-primary/20 bg-primary/5 shadow-sm">
                <div className="text-[9px] text-primary/60 font-black uppercase tracking-widest mb-1">21e8</div>
                <div className="font-black text-sm">15 PTS</div>
              </div>
              <div className="p-3 border-2 border-primary/20 bg-primary/5 shadow-sm">
                <div className="text-[9px] text-primary/60 font-black uppercase tracking-widest mb-1">21e80</div>
                <div className="font-black text-sm">60 PTS</div>
              </div>
              <div className="p-3 border-2 border-primary/20 bg-primary/5 shadow-sm">
                <div className="text-[9px] text-primary/60 font-black uppercase tracking-widest mb-1">21e800</div>
                <div className="font-black text-sm">240 PTS</div>
              </div>
              <div className="p-3 border-2 border-primary/20 bg-primary/5 shadow-sm">
                <div className="text-[9px] text-primary/60 font-black uppercase tracking-widest mb-1">21e8000</div>
                <div className="font-black text-sm">960 PTS</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
