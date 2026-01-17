import { Globe, Shield, Zap, Lock, MessageSquare, Calendar, LayoutGrid } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SiteSettings } from '../../lib/site-settings'

interface AdminSettingsProps {
  siteSettings: SiteSettings | null
  savingSettings: boolean
  handleUpdateSettings: (updates: Partial<SiteSettings>) => Promise<void>
}

export function AdminSettings({ siteSettings, savingSettings, handleUpdateSettings }: AdminSettingsProps) {
  if (!siteSettings) return null

  return (
    <Card className="border-4 border-foreground">
      <CardHeader className="bg-black text-white border-b-4 border-black">
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Global Site Settings
        </CardTitle>
        <CardDescription className="font-mono text-xs text-gray-300 mt-1">
          Control system-wide difficulty, access, and personality
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Security & Access */}
          <div className="space-y-6">
            <div className="border-2 border-foreground p-4 bg-muted/50 rounded-lg">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security & Access
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-mono font-bold">Invite-Only Mode</Label>
                    <p className="text-xs text-muted-foreground font-mono">Require invite code for registration</p>
                  </div>
                  <Switch
                    checked={siteSettings.isInviteOnly}
                    onCheckedChange={(checked) => handleUpdateSettings({ isInviteOnly: checked })}
                    disabled={savingSettings}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-mono font-bold">Maintenance Mode</Label>
                    <p className="text-xs text-muted-foreground font-mono">Disable all actions for non-admins</p>
                  </div>
                  <Switch
                    checked={siteSettings.maintenanceMode}
                    onCheckedChange={(checked) => handleUpdateSettings({ maintenanceMode: checked })}
                    disabled={savingSettings}
                  />
                </div>
              </div>
            </div>

            <div className="border-2 border-foreground p-4 bg-muted/50 rounded-lg">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                PoW Parameters
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Difficulty Multiplier</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={siteSettings.difficultyMultiplier}
                      onChange={(e) => handleUpdateSettings({ difficultyMultiplier: parseFloat(e.target.value) })}
                      className="font-mono h-8 text-xs border-2 border-foreground"
                    />
                    <div className="text-[10px] font-mono flex items-center bg-foreground text-background px-2">X</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Diamond Boost</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="10"
                      value={siteSettings.diamondBoost}
                      onChange={(e) => handleUpdateSettings({ diamondBoost: parseFloat(e.target.value) })}
                      className="font-mono h-8 text-xs border-2 border-foreground"
                    />
                    <div className="text-[10px] font-mono flex items-center bg-foreground text-background px-2">X</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Content & Personality */}
          <div className="space-y-6">
            <div className="border-2 border-foreground p-4 bg-muted/50 rounded-lg">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Talky Bot Personality
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Current Personality</Label>
                  <Select
                    value={siteSettings.talkyPersonality}
                    onValueChange={(value) => handleUpdateSettings({ talkyPersonality: value })}
                  >
                    <SelectTrigger className="font-mono h-8 text-xs border-2 border-foreground">
                      <SelectValue placeholder="Select personality" />
                    </SelectTrigger>
                    <SelectContent className="font-mono border-2 border-foreground">
                      <SelectItem value="helpful">Helpful Guide</SelectItem>
                      <SelectItem value="snarky">Snarky Tech Bro</SelectItem>
                      <SelectItem value="mysterious">Mysterious Sage</SelectItem>
                      <SelectItem value="neutral">Neutral System Bot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-2 border-foreground p-4 bg-muted/50 rounded-lg">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Content Management
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Pruning Threshold (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={siteSettings.pruningThresholdDays}
                    onChange={(e) => handleUpdateSettings({ pruningThresholdDays: parseInt(e.target.value) })}
                    className="font-mono h-8 text-xs border-2 border-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground font-mono italic">Threads inactive longer than this will be expired.</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-foreground p-4 bg-muted/50 rounded-lg">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Site Broadcast
              </h3>
              <div className="space-y-2">
                <Label className="font-mono text-xs">Message of the Day (MOTD)</Label>
                <Textarea
                  placeholder="Enter broadcast message..."
                  value={siteSettings.motd}
                  onChange={(e) => handleUpdateSettings({ motd: e.target.value })}
                  className="font-mono min-h-[80px] text-xs border-2 border-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
