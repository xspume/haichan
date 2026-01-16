import React, { useState } from 'react';
import { blink } from '../../lib/db-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, Sparkles, Wand2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ThemeColors, applyTheme, CustomTheme } from '../../lib/theme-utils';
import { useAuth } from '../../contexts/AuthContext';

const THEME_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    colors: {
      type: 'object',
      properties: {
        background: { type: 'string' },
        foreground: { type: 'string' },
        primary: { type: 'string' },
        primaryForeground: { type: 'string' },
        secondary: { type: 'string' },
        secondaryForeground: { type: 'string' },
        accent: { type: 'string' },
        accentForeground: { type: 'string' },
        border: { type: 'string' },
        muted: { type: 'string' },
        mutedForeground: { type: 'string' },
        card: { type: 'string' },
        cardForeground: { type: 'string' },
      },
      required: ['background', 'foreground', 'primary', 'primaryForeground', 'secondary', 'secondaryForeground', 'accent', 'accentForeground', 'border', 'muted', 'mutedForeground', 'card', 'cardForeground']
    },
    visualAssets: {
      type: 'object',
      properties: {
        backgroundPrompt: { type: 'string', description: 'Detailed prompt for generating a background image matching this theme' },
        logoPrompt: { type: 'string', description: 'Detailed prompt for generating a logo or mascot matching this theme' },
        buttonPrompt: { type: 'string', description: 'Detailed prompt for generating a custom 90s-style button image' },
        buttonHoverPrompt: { type: 'string', description: 'Detailed prompt for generating a custom 90s-style button image for HOVER state (usually brighter or glowier)' },
        buttonActivePrompt: { type: 'string', description: 'Detailed prompt for generating a custom 90s-style button image for ACTIVE/PRESSED state (usually darker or shifted)' },
        cardPrompt: { type: 'string', description: 'Detailed prompt for generating a custom card background image' }
      },
      required: ['backgroundPrompt', 'logoPrompt', 'buttonPrompt', 'buttonHoverPrompt', 'buttonActivePrompt', 'cardPrompt']
    },
    fonts: {
      type: 'object',
      properties: {
        heading: { type: 'string', description: 'Font name for headings (e.g. "Crimson Text", "Press Start 2P")' },
        body: { type: 'string', description: 'Font name for body text (e.g. "Arial", "IBM Plex Mono")' }
      }
    }
  },
  required: ['name', 'description', 'colors', 'visualAssets']
};

interface AIThemeCreatorProps {
  onThemeSaved: () => void;
}

export const AIThemeCreator: React.FC<AIThemeCreatorProps> = ({ onThemeSaved }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTheme, setGeneratedTheme] = useState<(Partial<CustomTheme> & { visualAssets?: any }) | null>(null);
  const [isRegeneratingBg, setIsRegeneratingBg] = useState(false);
  const [isRegeneratingLogo, setIsRegeneratingLogo] = useState(false);
  const { authState, dbUser } = useAuth();
  const user = authState.user;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Architecting your unique theme...');
    
    try {
      // 1. Generate Theme JSON (Colors + Prompts)
      const { object } = await blink.ai.generateObject({
        prompt: `Create a professional and beautiful UI theme for an imageboard based on this prompt: "${prompt}". 
        Include a complete color palette with hex values.
        Also provide specific prompts for generating a background image, a logo/mascot, and custom button assets for normal, hover, and active states.
        Think magical girl, Y2K aesthetics, retro Windows 95, or tropical Tiki styles if appropriate.`,
        schema: THEME_SCHEMA as any
      });

      const themeData = object as any;
      
      // 2. Generate Background Image
      const bgResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.backgroundPrompt}. Style: 90s aesthetic, high quality, digital art, atmospheric background.`,
        size: '1024x1024'
      });

      // 3. Generate Logo Image
      const logoResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.logoPrompt}. Style: mascot logo, icon, vector-like, 90s anime aesthetic, centered on solid background.`,
        size: '1024x1024'
      });

      // 4. Generate Button Image
      const buttonResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.buttonPrompt}. Style: 90s GUI button, pixel art, high-tech interface, flat but textured, rectangle shape.`,
        size: '1024x1024'
      });

      // 5. Generate Button Hover Image
      const buttonHoverResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.buttonHoverPrompt}. Style: 90s GUI button hover state, pixel art, high-tech interface, glowing or highlighted, rectangle shape.`,
        size: '1024x1024'
      });

      // 6. Generate Button Active Image
      const buttonActiveResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.buttonActivePrompt}. Style: 90s GUI button pressed state, pixel art, high-tech interface, dark or recessed, rectangle shape.`,
        size: '1024x1024'
      });

      // 7. Generate Card Image
      const cardResponse = await blink.ai.generateImage({
        prompt: `${themeData.visualAssets.cardPrompt}. Style: 90s UI panel, tech texture, subtle grid, translucent or solid matching the theme.`,
        size: '1024x1024'
      });

      const fullTheme: CustomTheme & { visualAssets: any } = {
        id: `custom-${Date.now()}`,
        name: themeData.name,
        description: themeData.description,
        colors: themeData.colors,
        fonts: themeData.fonts,
        backgroundImage: bgResponse.data[0].url,
        logoImage: logoResponse.data[0].url,
        buttonImage: buttonResponse.data[0].url,
        buttonHoverImage: buttonHoverResponse.data[0].url,
        buttonActiveImage: buttonActiveResponse.data[0].url,
        cardBackgroundImage: cardResponse.data[0].url,
        totalPow: 0,
        visualAssets: themeData.visualAssets
      };

      setGeneratedTheme(fullTheme);
      toast.dismiss(loadingToast);
      toast.success('Theme materialized!');
      
      // Preview immediately
      applyTheme('preview', fullTheme.colors, fullTheme.backgroundImage, fullTheme.logoImage, fullTheme.fonts, {
        buttonImage: fullTheme.buttonImage,
        buttonHoverImage: fullTheme.buttonHoverImage,
        buttonActiveImage: fullTheme.buttonActiveImage,
        cardBackgroundImage: fullTheme.cardBackgroundImage
      });
      
    } catch (error) {
      console.error('Generation failed:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate theme');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateBg = async () => {
    if (!generatedTheme?.visualAssets?.backgroundPrompt) return;
    setIsRegeneratingBg(true);
    try {
      const bgResponse = await blink.ai.generateImage({
        prompt: `${generatedTheme.visualAssets.backgroundPrompt}. Style: 90s aesthetic, high quality, digital art, atmospheric background.`,
        size: '1024x1024'
      });
      const newUrl = bgResponse.data[0].url;
      setGeneratedTheme(prev => prev ? { ...prev, backgroundImage: newUrl } : null);
      applyTheme('preview', generatedTheme.colors!, newUrl, generatedTheme.logoImage, generatedTheme.fonts);
      toast.success('Background regenerated');
    } catch (e) {
      toast.error('Failed to regenerate background');
    } finally {
      setIsRegeneratingBg(false);
    }
  };

  const handleRegenerateLogo = async () => {
    if (!generatedTheme?.visualAssets?.logoPrompt) return;
    setIsRegeneratingLogo(true);
    try {
      const logoResponse = await blink.ai.generateImage({
        prompt: `${generatedTheme.visualAssets.logoPrompt}. Style: mascot logo, icon, vector-like, 90s anime aesthetic, centered on solid background.`,
        size: '1024x1024'
      });
      const newUrl = logoResponse.data[0].url;
      setGeneratedTheme(prev => prev ? { ...prev, logoImage: newUrl } : null);
      applyTheme('preview', generatedTheme.colors!, generatedTheme.backgroundImage, newUrl, generatedTheme.fonts);
      toast.success('Logo regenerated');
    } catch (e) {
      toast.error('Failed to regenerate logo');
    } finally {
      setIsRegeneratingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTheme || !user) {
      toast.error('Sign in to save themes');
      return;
    }

    setIsSaving(true);
    try {
      const themeId = generatedTheme.id || `custom-${Date.now()}`;
      
      // Persist to communal library
      await (blink.db as any).siteThemes.create({
        id: themeId,
        userId: user.id,
        username: dbUser?.displayName || user.display_name || user.username || 'Anonymous',
        name: generatedTheme.name,
        description: generatedTheme.description,
        colors: JSON.stringify(generatedTheme.colors),
        backgroundImage: generatedTheme.backgroundImage,
        logoImage: generatedTheme.logoImage,
        buttonImage: generatedTheme.buttonImage,
        buttonHoverImage: generatedTheme.buttonHoverImage,
        buttonActiveImage: generatedTheme.buttonActiveImage,
        cardBackgroundImage: generatedTheme.cardBackgroundImage,
        fonts: JSON.stringify(generatedTheme.fonts || {}),
        totalPow: 0
      });

      // Also set as active theme locally
      applyTheme(themeId, generatedTheme.colors!, generatedTheme.backgroundImage, generatedTheme.logoImage, generatedTheme.fonts, {
        buttonImage: generatedTheme.buttonImage,
        buttonHoverImage: generatedTheme.buttonHoverImage,
        buttonActiveImage: generatedTheme.buttonActiveImage,
        cardBackgroundImage: generatedTheme.cardBackgroundImage
      });

      toast.success('Theme saved to communal library!');
      onThemeSaved();
      setGeneratedTheme(null);
      setPrompt('');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <CardTitle>AI Theme Creator</CardTitle>
        </div>
        <CardDescription>
          Describe the vibe you want and let AI craft a high-end custom theme for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Input
              placeholder="e.g. 'Cyberpunk 2077 with neon yellow accents', 'Midnight forest in autumn', 'Minimalist paper-like beige'..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="pr-12 h-12 bg-background/50 border-primary/30 focus:border-primary"
              disabled={isGenerating}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-10 w-10 text-primary hover:bg-primary/10"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            </Button>
          </div>

          {generatedTheme && (
            <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-background/50 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">{generatedTheme.name}</h3>
                  <p className="text-sm text-muted-foreground">{generatedTheme.description}</p>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/80"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save to Library
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Background</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-primary hover:bg-primary/10"
                      onClick={handleRegenerateBg}
                      disabled={isRegeneratingBg}
                    >
                      <RefreshCw className={`w-3 h-3 ${isRegeneratingBg ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="aspect-video rounded-md border border-primary/30 overflow-hidden bg-black/20">
                    <img src={generatedTheme.backgroundImage} alt="Background" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Mascot / Logo</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-primary hover:bg-primary/10"
                      onClick={handleRegenerateLogo}
                      disabled={isRegeneratingLogo}
                    >
                      <RefreshCw className={`w-3 h-3 ${isRegeneratingLogo ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="aspect-video rounded-md border border-primary/30 overflow-hidden bg-black/20 flex items-center justify-center p-2">
                    <img src={generatedTheme.logoImage} alt="Logo" className="h-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Custom Button Asset</span>
                  <div className="h-12 rounded-md border border-primary/30 overflow-hidden bg-black/20 flex items-center justify-center">
                    <img src={generatedTheme.buttonImage} alt="Button" className="h-8 object-contain" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Card Background Asset</span>
                  <div className="h-12 rounded-md border border-primary/30 overflow-hidden bg-black/20">
                    <img src={generatedTheme.cardBackgroundImage} alt="Card BG" className="w-full h-full object-cover opacity-50" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {generatedTheme.colors && Object.entries(generatedTheme.colors).slice(0, 14).map(([key, value]) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <div 
                      className="w-full aspect-square rounded-md border border-border" 
                      style={{ backgroundColor: value as string }}
                      title={key}
                    />
                    <span className="text-[8px] uppercase font-mono truncate w-full text-center">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
