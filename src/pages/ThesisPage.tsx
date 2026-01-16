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
          BACK
        </button>

        <div className="border-4 border-foreground bg-card text-card-foreground p-6">
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8" />
            HAICHAN THESIS
          </h1>

          <div className="prose prose-invert max-w-none font-mono text-sm space-y-6">
            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">ABSTRACT</h2>
              <p className="text-muted-foreground leading-relaxed">
                Haichan is a proof-of-work mediated imageboard that combines the permissionless
                nature of cryptocurrency with traditional forum-style communication. By requiring
                SHA-256 mining for all user actions, we create a system where participation has
                inherent computational cost, deterring spam and abuse while establishing a
                meritocratic hierarchy based on contributed work.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">21E8 PREFIX</h2>
              <p className="text-muted-foreground leading-relaxed">
                All valid proof-of-work on Haichan must produce SHA-256 hashes beginning with
                the prefix "21e8". This prefix was chosen for its significance in physics
                (referencing the E8 Lie group and theories of everything) and its aesthetic
                qualities in hexadecimal representation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">IDENTITY SYSTEM</h2>
              <p className="text-muted-foreground leading-relaxed">
                User identity is cryptographically tied to Bitcoin addresses via secp256k1
                elliptic curve cryptography. This creates a pseudonymous yet accountable
                identity system where reputation is earned through cumulative proof-of-work
                rather than arbitrary social metrics.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold border-b border-muted pb-2 mb-4">TRANCHE SYSTEM</h2>
              <p className="text-muted-foreground leading-relaxed">
                Haichan operates with a 256-user cap per tranche and invite-gated registration.
                This creates scarcity and ensures that early participants have a stake in
                maintaining community quality. Each tranche represents a cohort of users who
                joined during a specific expansion epoch.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
