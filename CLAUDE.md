# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Haichan is a PoW-mediated imageboard where all user actions (posting, threading, blogging, chatting) require SHA-256 proof-of-work mining with hashes starting with `21e8`. User identity is tied to mined Bitcoin addresses via secp256k1 cryptographic authentication. The site operates with a 256-user cap per tranche and is invite-gated for registration.

## Development Commands

```bash
bun install                                           # Install dependencies
bun run dev                                           # Start development server
bun run build                                         # Build for production
bun run lint                                          # Run linting
bun run test                                          # Run all tests
vitest run src/lib/mining/__tests__/MiningEngine.test.ts  # Run single test
```

## Two Database Clients (Critical Architecture)

In `src/lib/db-client.ts` there are two clients:

- **`db` (default)**: Authenticated client that attaches user JWT when signed in. Use for user-scoped writes and any protected modules.
- **`publicDb`**: No JWT attached. Use for global/public reads (boards, threads, posts, leaderboards) to avoid RLS user-scoping issues where authenticated requests return empty lists.

```typescript
import db, { publicDb } from '@/lib/db-client'

// User-scoped write (requires auth)
await db.db.posts.create({ ... })

// Global read (no user filtering)
const threads = await publicDb.db.threads.list({ ... })
```

## Mining System Architecture

### Three-Tier Priority
- **Dedicated**: Highest priority (manual "Mine" button for posting)
- **Mouseover**: Medium priority (hover mining on threads/posts)
- **Background**: Lowest priority (ambient global mining)

### Component Hierarchy
```
MiningManager (singleton orchestrator)
    └── MiningEngine (worker lifecycle)
            └── hash.worker.ts (Web Crypto SHA-256)
```

### PoW Point Formula
Points = `15 × 4^(trailing_zeros)` where trailing zeros are counted after the `21e8` prefix.

| Trailing Zeros | Points |
|----------------|--------|
| 0              | 15     |
| 1              | 60     |
| 2              | 240    |
| 3              | 960    |

## Key Architectural Patterns

### AuthContext Safety Timeouts
- **Auth loading timeout**: 10 seconds (forces `isAuthLoading` to false if SDK hangs)
- **DB user loading timeout**: 8 seconds (forces `isDbLoading` to false if query hangs)

### Realtime Subscriptions
Realtime subscriptions require JWT authentication. Only set up subscriptions after confirming `db.auth.isAuthenticated()` is true.

### Edge Functions
- `validate-pow`: Validates PoW submissions and updates user/target points
- `increment-post-number`: Atomically increments global post numbers
- `get-user-by-username`: Fetches user by username for @ mentions
- `talky-bot`: AI chat bot responses
- `price-bot`: Cryptocurrency price queries
- `cleanup-expired`: Prunes expired threads/boards

### Routing Patterns
- Pages are lazy-loaded via `React.lazy()` with `Suspense` fallback
- Protected routes use `<ProtectedRoute>` wrapper that checks `useAuth()` context
- Legacy 4chan-style URLs (`/:boardSlug`) redirect to `/board/:boardSlug`

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend/SDK**: Blink SDK (Auth, Database, Storage, AI)
- **Edge Functions**: Blink Edge Functions (Deno)
- **PoW**: Web Crypto SHA-256 via Web Workers
- **Blockchain**: bitcoinjs-lib, tiny-secp256k1
