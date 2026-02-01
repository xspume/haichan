import React, { useEffect, useState } from 'react';
import { blink } from '../../lib/db-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Loader2, Trash2, User, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CustomTheme, applyTheme, getStoredThemeInfo } from '../../lib/theme-utils';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';

interface ThemeLibraryProps {
  refreshTrigger: number;
}

export const ThemeLibrary: React.FC<ThemeLibraryProps> = ({ refreshTrigger }) => {
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeThemeId, setActiveThemeId] = useState<string>(getStoredThemeInfo());
  const { authState } = useAuth();
  const user = authState.user;

  useEffect(() => {
    fetchThemes();
  }, [refreshTrigger]);

  const fetchThemes = async () => {
    setIsLoading(true);
    try {
      // SDK uses camelCase for tables: site_themes -> siteThemes
      const data = await (blink.db as any).siteThemes.list({
        orderBy: { createdAt: 'desc' },
        limit: 50
      });
      
      const parsedThemes = data.map((t: any) => ({
        ...t,
        colors: JSON.parse(t.colors),
        fonts: t.fonts ? JSON.parse(t.fonts) : {}
      }));
      
      setThemes(parsedThemes);
    } catch (error) {
      console.error('Failed to fetch themes:', error);
      toast.error('Failed to load library');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (theme: CustomTheme) => {
    applyTheme(theme.id, theme.colors, theme.backgroundImage, theme.logoImage, theme.fonts, {
      buttonImage: theme.buttonImage,
      buttonHoverImage: theme.buttonHoverImage,
      buttonActiveImage: theme.buttonActiveImage,
      cardBackgroundImage: theme.cardBackgroundImage,
      navBackgroundImage: theme.navBackgroundImage
    });
    setActiveThemeId(theme.id);
    toast.success(`Applied ${theme.name}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this theme?')) return;
    
    try {
      await (blink.db as any).siteThemes.delete(id);
      toast.success('Theme deleted');
      fetchThemes();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
        <Palette className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h3 className="text-lg font-bold text-muted-foreground">Library is empty</h3>
        <p className="text-sm text-muted-foreground">Be the first to create a theme!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
      {themes.map((theme) => (
        <Card 
          key={theme.id}
          className={`group overflow-hidden transition-all hover:scale-[1.01] border-2 shadow-sm hover:shadow-3d-sm ${
            activeThemeId === theme.id ? 'border-primary' : 'border-primary/20'
          }`}
        >
          <div 
            className="h-32 w-full relative overflow-hidden bg-muted/20"
            style={{ backgroundColor: theme.colors.background }}
          >
            {theme.backgroundImage && (
              <img 
                src={theme.backgroundImage} 
                alt="preview" 
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              {theme.logoImage ? (
                <img src={theme.logoImage} alt="logo" className="h-16 w-16 object-contain z-10" />
              ) : (
                <>
                  <div className="w-6 h-6 shadow-md border border-background" style={{ backgroundColor: theme.colors.primary }}></div>
                  <div className="w-6 h-6 shadow-md border border-background" style={{ backgroundColor: theme.colors.secondary }}></div>
                  <div className="w-6 h-6 shadow-md border border-background" style={{ backgroundColor: theme.colors.accent }}></div>
                </>
              )}
            </div>
            {activeThemeId === theme.id && (
              <Badge className="absolute top-2 right-2 bg-primary text-background font-black uppercase tracking-widest text-[8px] py-0.5 px-1.5 border-none shadow-sm">
                <Check className="w-2.5 h-2.5 mr-1" /> Active
              </Badge>
            )}
          </div>
          
          <CardHeader className="pb-3 bg-primary/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center justify-between text-primary">
              {theme.name}
              <div className="flex items-center gap-1">
                {user?.id === theme.userId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 border-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(theme.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription className="line-clamp-2 h-10 text-[10px] font-bold opacity-70 uppercase tracking-tight">
              {theme.description || 'A custom theme created by AI.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 bg-background">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-4 font-black uppercase tracking-widest">
              <User className="w-3 h-3 text-primary opacity-60" />
              <span className="truncate">{theme.username}</span>
            </div>

            <Button 
              className="w-full font-black uppercase text-[10px] tracking-widest h-9 shadow-md"
              variant={activeThemeId === theme.id ? "default" : "outline"}
              onClick={() => handleApply(theme)}
            >
              {activeThemeId === theme.id ? 'ACTIVE' : 'APPLY THEME'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
