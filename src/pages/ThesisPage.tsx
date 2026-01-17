import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'

export function ThesisPage() {
  const navigate = useNavigate()

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8" />
            Haichan Thesis
          </h1>

          <div className="prose prose-invert max-w-none font-mono text-sm space-y-6">
            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">Abstract</h2>
              <p className="text-muted-foreground leading-relaxed">
                Haichan is an imageboard that uses proof-of-work to verify user actions.
                By requiring a small amount of verification for all posts, we create a system where participation is intentional, 
                deterring spam while establishing a reputation system based on effort.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">Verification Prefix</h2>
              <p className="text-muted-foreground leading-relaxed">
                All valid work on Haichan must produce hashes beginning with
                a specific prefix. This serves as a barrier to entry, ensuring that each post has a verifiable cost.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">Identity System</h2>
              <p className="text-muted-foreground leading-relaxed">
                User identity is tied to cryptographic addresses. This creates a secure
                identity system where reputation is earned through participation rather than social metrics.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">Community Growth</h2>
              <p className="text-muted-foreground leading-relaxed">
                Haichan uses an invite-gated registration system to manage community growth.
                This ensures that participants have a stake in maintaining community quality.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
