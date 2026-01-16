import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, User, Bell, Palette } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import db from '../lib/db-client'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [displayName, setDisplayName] = useState(dbUser?.displayName || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!dbUser) return

    setSaving(true)
    try {
      await db.db.users.update(dbUser.id, {
        displayName: displayName.trim()
      })
      toast.success('Settings saved!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3">
            <Settings className="w-6 h-6" />
            SETTINGS
          </h1>
        </div>

        <div className="space-y-4">
          <Card className="border-2 border-foreground">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <User className="w-5 h-5" />
                PROFILE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="displayName" className="font-mono">DISPLAY NAME</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="font-mono">USERNAME</Label>
                <Input
                  value={dbUser?.username || ''}
                  disabled
                  className="mt-1 font-mono bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="font-mono"
              >
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-foreground">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Palette className="w-5 h-5" />
                APPEARANCE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label className="font-mono">DARK MODE</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-foreground">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <Bell className="w-5 h-5" />
                NOTIFICATIONS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label className="font-mono">ENABLE NOTIFICATIONS</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
