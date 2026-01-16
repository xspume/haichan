import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Image, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import db from '../lib/db-client'

export function LastUsedImagesPage() {
  const navigate = useNavigate()
  const { dbUser } = useAuth()
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadImages() {
      try {
        if (!dbUser) return

        const userImages = await db.db.images.list({
          where: { userId: dbUser.id },
          limit: 50
        })
        setImages(userImages || [])
      } catch (error) {
        console.error('Failed to load images:', error)
      } finally {
        setLoading(false)
      }
    }

    loadImages()
  }, [dbUser])

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2 animate-pulse">LOADING...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate('/images')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO IMAGES
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 mb-6">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3">
            <Clock className="w-6 h-6" />
            RECENTLY USED IMAGES
          </h1>
        </div>

        {images.length === 0 ? (
          <div className="border-2 border-dashed border-muted-foreground p-8 text-center">
            <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-mono">No images found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <div key={image.id} className="border-2 border-foreground p-2">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {image.url ? (
                    <img
                      src={image.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
