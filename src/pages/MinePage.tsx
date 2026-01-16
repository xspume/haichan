import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Pickaxe, Zap, Trophy } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'

export function MinePage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()

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

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3">
            <Pickaxe className="w-6 h-6" />
            MINING DASHBOARD
          </h1>
          <p className="text-muted-foreground font-mono mt-2">
            Mine SHA-256 proof-of-work to earn points and unlock features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-4 border-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                TOTAL POW
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {(dbUser?.totalPowPoints || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-4 border-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Zap className="w-4 h-4" />
                STATUS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono text-green-500">
                ACTIVE
              </div>
            </CardContent>
          </Card>

          <Card className="border-4 border-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Pickaxe className="w-4 h-4" />
                PREFIX
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold font-mono">
                21e8
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h2 className="text-xl font-bold font-mono mb-4">POW POINT FORMULA</h2>
          <div className="font-mono text-sm space-y-2">
            <p>Points = 15 x 4^(trailing_zeros)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3 border border-muted">
                <div className="text-xs text-muted-foreground">21e8</div>
                <div className="font-bold">15 pts</div>
              </div>
              <div className="p-3 border border-muted">
                <div className="text-xs text-muted-foreground">21e80</div>
                <div className="font-bold">60 pts</div>
              </div>
              <div className="p-3 border border-muted">
                <div className="text-xs text-muted-foreground">21e800</div>
                <div className="font-bold">240 pts</div>
              </div>
              <div className="p-3 border border-muted">
                <div className="text-xs text-muted-foreground">21e8000</div>
                <div className="font-bold">960 pts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
