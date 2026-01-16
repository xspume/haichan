import { Clock, Shield, Info, Scroll } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export function AboutPage() {
  const events = [
    {
      date: '2026-01-15',
      title: 'Spam Wave Mitigation',
      description: 'Systemic 2^18 padded difficulty implemented to counteract automated low-effort flooding. Median thread effort spiked by 4.2x.'
    },
    {
      date: '2026-01-03',
      title: 'Protocol Initialization',
      description: 'Haichan V0.3 online. Proof-of-work gating active for all write operations. Initial calibration thread established.'
    },
    {
      date: '2025-12-31',
      title: 'Diamond Tier Calibration',
      description: 'Thresholds for legendary status adjusted based on global network hash rate. Persistence of memory verified.'
    }
  ]

  return (
    <div className="bg-background text-foreground min-h-screen p-4 font-mono">
      <div className="container mx-auto max-w-3xl">
        <header className="mb-8 border-b-4 border-foreground pb-4">
          <h1 className="text-6xl text-outline-header mb-2 uppercase italic">Info</h1>
          <p className="text-sm font-bold uppercase">The Haichan System & History</p>
        </header>

        <Tabs defaultValue="manifesto" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 border-2 border-foreground bg-muted p-1">
            <TabsTrigger value="manifesto" className="data-[state=active]:bg-foreground data-[state=active]:text-background font-bold uppercase py-2">
              <Shield className="w-4 h-4 mr-2" />
              Manifesto
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-foreground data-[state=active]:text-background font-bold uppercase py-2">
              <Clock className="w-4 h-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="faq" className="data-[state=active]:bg-foreground data-[state=active]:text-background font-bold uppercase py-2">
              <Info className="w-4 h-4 mr-2" />
              FAQ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manifesto" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase bg-foreground text-background inline-block px-2">What This Is Not</h2>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li className="flex gap-4">
                  <span className="font-bold">01</span>
                  <span><span className="font-black">No social graphs.</span> We do not care who follows you. Relationships are transient; only the work remains.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">02</span>
                  <span><span className="font-black">No karma.</span> Your past deeds do not grant you future rights. Every post must pay the current market price in computation.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">03</span>
                  <span><span className="font-black">No ad impressions.</span> Your attention is not our product. Your computational power is our protocol's oxygen.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">04</span>
                  <span><span className="font-black">No onboarding paths.</span> There is no "user journey." There is only a barrier of entry. If you cannot mine, you cannot speak.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase bg-foreground text-background inline-block px-2">The Doctrine</h2>
              <p className="text-sm leading-relaxed">
                Haichan is not marketing. It is protocol governance via energy expenditure.
                We prioritize <span className="font-black italic underline">Economics over Policy</span>.
                Content moderation is handled by the rising difficulty of attention.
              </p>
              <p className="text-sm leading-relaxed italic border-l-4 border-foreground pl-4">
                "Expression is costly. Reading is cheap. Silence is default."
              </p>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-8">
              {events.map((event, i) => (
                <article key={i} className="relative pl-8 border-l-2 border-foreground/30">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-foreground border-4 border-background" />
                  <time className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                    {event.date}
                  </time>
                  <h2 className="text-xl font-black uppercase mb-2">{event.title}</h2>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {event.description}
                  </p>
                </article>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="faq" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">How do I post?</h3>
                <p className="text-sm text-foreground/80">You must solve a cryptographic puzzle (Proof of Work) before your content is accepted. Your CPU will do this work automatically when you click post.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">What is 21e8?</h3>
                <p className="text-sm text-foreground/80">21e8 is a specific prefix (representing the Bitcoin total supply 21 million and the "8" from its hash) that signifies high-effort computation. It is the barrier of entry for Haichan.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">Is this Bitcoin?</h3>
                <p className="text-sm text-foreground/80">No, it uses the same SHA-256 algorithm but the points earned are protocol-specific. However, user identities are tied to public keys that can correspond to Bitcoin addresses.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="mt-20 pt-8 border-t border-foreground text-[10px] text-muted-foreground uppercase flex justify-between">
          <span>Version 0.3</span>
        </footer>
      </div>
    </div>
  )
}
