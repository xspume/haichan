import { Clock, Shield, Info, Scroll } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export function AboutPage() {
  const events = [
    {
      date: '2026-01-15',
      title: 'Anti-Spam Measures',
      description: 'Implemented advanced difficulty scaling to prevent automated flooding. Quality of content has significantly improved.'
    },
    {
      date: '2026-01-03',
      title: 'Official Launch',
      description: 'Haichan V0.3 is now live. All posting and threads are secured by computational verification.'
    },
    {
      date: '2025-12-31',
      title: 'Reputation Updates',
      description: 'Adjusted reward tiers based on community participation. User history is now more effectively recognized.'
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
              <h2 className="text-xl font-black uppercase bg-foreground text-background inline-block px-2">Core Principles</h2>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li className="flex gap-4">
                  <span className="font-bold">01</span>
                  <span><span className="font-black">No following.</span> We focus on content rather than social connections. Only the work remains.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">02</span>
                  <span><span className="font-black">No vanity points.</span> Your past deeds do not grant you future rights. Every post is validated through current effort.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">03</span>
                  <span><span className="font-black">No advertising.</span> Your attention is not our product. We prioritize user contribution over data collection.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">04</span>
                  <span><span className="font-black">Verification required.</span> There is a barrier to entry to ensure quality. If you cannot verify, you cannot post.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase bg-foreground text-background inline-block px-2">The Mission</h2>
              <p className="text-sm leading-relaxed">
                Haichan is an experiment in community self-governance.
                We believe in effort as a filter for high-quality discussion.
              </p>
              <p className="text-sm leading-relaxed italic border-l-4 border-foreground pl-4">
                "Expression has value. Quality is preferred over quantity."
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
                <p className="text-sm text-foreground/80">You must solve a verification puzzle (Proof of Work) before your content is accepted. Your computer will do this automatically when you click post.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">What is Proof of Work?</h3>
                <p className="text-sm text-foreground/80">Proof of Work is a way to ensure that posts are made by real people rather than bots. It requires a small amount of computational effort to validate each action.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">Is this related to Bitcoin?</h3>
                <p className="text-sm text-foreground/80">It uses similar cryptographic principles to Bitcoin for verification and identity, but it is a separate system dedicated to community discussion.</p>
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
