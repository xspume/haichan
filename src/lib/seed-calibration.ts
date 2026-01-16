import db from './db-client'

export async function seedCalibrationThread() {
  try {
    console.log('🚀 Seeding Canonical Calibration Thread...')

    // Check if it already exists in the "meta" board or similar
    // We'll put it in the "haichan" board if it exists, or create it.
    let boardId = ''
    const boards = await db.db.boards.list({ where: { slug: 'meta' } })
    
    if (boards.length === 0) {
      const newBoard = await db.db.boards.create({
        name: 'Meta',
        slug: 'meta',
        description: 'Discussion about the board itself',
        totalPow: 50000, // High starting PoW
        createdAt: new Date().toISOString()
      })
      boardId = newBoard.id
    } else {
      boardId = boards[0].id
    }

    // Check if the calibration thread exists
    const threads = await db.db.threads.list({ 
      where: { boardId, title: 'CANONICAL CALIBRATION THREAD' } 
    })

    if (threads.length === 0) {
      console.log('📝 Creating Calibration Thread...')
      await db.db.threads.create({
        boardId,
        userId: 'system',
        username: 'HAICHAN_CORE',
        title: 'CANONICAL CALIBRATION THREAD',
        content: `
[ CALIBRATION ARTIFACT ]
ID: 0x21e8-LEGENDARY
TARGET DIFFICULTY: 21e800000
TOTAL PROOF-OF-WORK: 10,000,000

This thread serves as the immutable baseline for computational effort on the Haichan protocol.
All future effort is measured against this datum.

NO REPLIES ALLOWED.
        `,
        totalPow: 10000000, // 10 million PoW
        createdAt: '2026-01-01T00:00:00.000Z',
        postNumber: 0,
        expired: 0
      })
      console.log('✓ Calibration Thread created')
    } else {
      console.log('✓ Calibration Thread already exists')
    }

    return { success: true }
  } catch (error: any) {
    console.error('❌ Calibration seeding failed:', error.message)
    return { success: false, error: error.message }
  }
}
