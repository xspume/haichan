/**
 * Seed function to create Music and Gif boards
 */

import db from './db-client'

export async function seedBoards() {
  try {
    console.log('🚀 Seeding Music, Gif, Tech, Art, and Meta boards...')

    // Check if boards already exist
    const existingBoards = await db.db.boards.list({})
    
    const boardsToSeed = [
      { name: 'Music', slug: 'music', description: 'Share, discuss, and rate music content' },
      { name: 'Gif', slug: 'gif', description: 'GIF and WebM animations only' },
      { name: 'Tech', slug: 'tech', description: 'Technology, programming, and hardware' },
      { name: 'Art', slug: 'art', description: 'Digital art, 90s aesthetic, and dithered content' },
      { name: 'Meta', slug: 'meta', description: 'Discussion about the board itself' }
    ]

    for (const board of boardsToSeed) {
      const exists = existingBoards.some(b => b.slug === board.slug)
      if (exists) {
        console.log(`✓ ${board.name} board already exists`)
      } else {
        console.log(`📝 Creating ${board.name} board...`)
        const newBoard = await db.db.boards.create({
          ...board,
          totalPow: 0,
          createdAt: new Date().toISOString()
        })
        console.log(`✓ ${board.name} board created`)

        // Create initial thread for the board to make it not look empty
        console.log(`📝 Creating initial thread for /${board.slug}/...`)
        await db.db.threads.create({
          boardId: newBoard.id,
          userId: 'system',
          username: 'SYSTEM',
          title: `Welcome to /${board.slug}/`,
          content: `This is the initial thread for the ${board.name} board. Start sharing and mining!`,
          totalPow: 100,
          createdAt: new Date().toISOString(),
          postNumber: 1,
          expired: 0
        })
      }
    }

    console.log('✅ Board seeding complete!')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Board seeding failed:', error.message)
    throw new Error(`Failed to seed boards: ${error.message}`)
  }
}
