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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {themes.map((theme) => (
        <Card 
          key={theme.id}
          className={`group overflow-hidden transition-all hover:scale-[1.02] border-2 ${
            activeThemeId === theme.id ? 'border-primary shadow-glow' : 'border-border'
          }`}
        >
          <div 
            className="h-32 w-full relative overflow-hidden"
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
                  <div className="w-6 h-6 rounded-full shadow-lg" style={{ backgroundColor: theme.colors.primary }}></div>
                  <div className="w-6 h-6 rounded-full shadow-lg" style={{ backgroundColor: theme.colors.secondary }}></div>
                  <div className="w-6 h-6 rounded-full shadow-lg" style={{ backgroundColor: theme.colors.accent }}></div>
                </>
              )}
            </div>
            {activeThemeId === theme.id && (
              <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                <Check className="w-3 h-3 mr-1" /> Active
              </Badge>
            )}
          </div>
          
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              {theme.name}
              <div className="flex items-center gap-1">
                {user?.id === theme.userId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(theme.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription className="line-clamp-2 h-10">
              {theme.description || 'A custom theme created by AI.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <User className="w-3 h-3" />
              <span>{theme.username}</span>
            </div>

            <Button 
              className="w-full font-mono"
              variant={activeThemeId === theme.id ? "default" : "outline"}
              onClick={() => handleApply(theme)}
            >
              {activeThemeId === theme.id ? 'Active' : 'Apply Theme'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
