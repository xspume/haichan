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
              <h2 className="text-xl font-black uppercase bg-foreground text-background inline-block px-2">rules</h2>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li className="flex gap-4">
                  <span className="font-bold">01</span>
                  <span>No following/followers. Content only.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">02</span>
                  <span>No karma farming. Each post stands alone.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">03</span>
                  <span>No ads. Your attention isn't for sale.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">04</span>
                  <span>Proof-of-work required. Can't hash, can't post.</span>
                </li>
                <li className="flex gap-4">
                  <span className="font-bold">05</span>
                  <span>Don't be a dickhead.</span>
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
                <p className="text-sm text-foreground/80">Write something, click post. Browser hashes until valid nonce. Few seconds.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-black uppercase text-lg border-b border-foreground/20 pb-1">What's proof-of-work?</h3>
                <p className="text-sm text-foreground/80">Your CPU does math until it finds a valid hash.</p>
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
