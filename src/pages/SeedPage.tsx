import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, CheckCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { seedBoards } from '../lib/seed-boards'
import toast from 'react-hot-toast'

export default function SeedPage() {
  const navigate = useNavigate()
  const [seeding, setSeeding] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedBoards()
      setCompleted(true)
      toast.success('Database seeded successfully!')
    } catch (error) {
      console.error('Seeding failed:', error)
      toast.error('Failed to seed database')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full p-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6 text-center">
          <Database className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-mono mb-4">SEED DATABASE</h1>
          <p className="text-muted-foreground font-mono mb-6 text-sm">
            Initialize the database with default boards and configuration.
          </p>

          {completed ? (
            <div className="flex items-center justify-center gap-2 text-green-500 font-mono">
              <CheckCircle className="w-5 h-5" />
              SEED COMPLETE
            </div>
          ) : (
            <Button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full font-mono"
            >
              {seeding ? 'SEEDING...' : 'SEED DATABASE'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
