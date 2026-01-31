# Haichan

Haichan is a black and white, 90s-styled imageboard where all posting and chat actions require proof-of-work (PoW) mining. User identity is tied to Bitcoin addresses, and content ranking is determined by the total work accumulated.

![Haichan Logo](public/favicon.svg)

## 🌐 Features

- **Proof-of-Work Economy**: Every action (posting, replying, chatting) requires valid hashes starting with the `21e8` prefix.
- **90s Aesthetic**: Minimalist black-and-white design with 3D shadows, grain overlays, and dithered image processing.
- **Cryptographic Identity**: Register with invite codes and authenticate using passwords or **secp256k1 keys** (Bitcoin private keys).
- **Ranking by Work**: Threads and posts are ranked based on the total PoW points they've accumulated.
- **Talky AI Bot**: A built-in AI assistant (@talky) that participates in chat and remembers conversations.
- **Personal Blogs**: Customizable blogs with unique fonts, themes, and PoW-backed publishing.
- **Global Chat**: A real-time chat room with online user tracking and AI interactions.
- **Multiplayer Canvas**: Collaborative drawing and mining space.
- **Dithered Image Processing**: Images are automatically processed with 1-bit dithering to maintain the aesthetic.

## 🛠 Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS (Custom 90s monochromatic theme)
- **Database**: Turso (via Blink SDK)
- **AI**: Blink AI (Text & Vision)
- **Mining**: Web Workers + hash-wasm (SHA-256)
- **Crypto**: bitcoinjs-lib + tiny-secp256k1

## 💎 Proof of Work Scoring

The system looks for the specific prefix `21e8`.
- `21e8` = 1 point
- `21e80` = 15 points
- `21e800` = 60 points
- Formula: `Points = 15 * 4^(extra_zeros)`

Rare hash patterns unlock **Diamond Levels**, granting special privileges like anonymity on boards.

## 🚀 Getting Started

### Prerequisites
- Node.js / Bun
- An invite code (required for registration)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the development server:
   ```bash
   bun dev
   ```

## 📜 Principles

1. **Crypto-first Auth**: Identity is derived from public keys and Bitcoin addresses.
2. **PoW as Visibility**: Quality is enforced by the computational cost of contribution.
3. **Anonymity vs Identity**: Anonymity is earned through work (Diamond levels).
4. **Information Density**: A highly interconnected, info-dense relational structure.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
