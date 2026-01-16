import db from './db-client'

/**
 * Seed Talky AI bot as a permanent user
 * This ensures Talky exists in the database and appears in the online users list
 */
export async function seedTalkyBot() {
  try {
    // Check if Talky already exists
    const existingUser = await db.db.users.list({
      where: { id: 'talky-bot' },
      limit: 1
    })

    if (existingUser && existingUser.length > 0) {
      console.log('✓ Talky bot already exists')
      
      // Update activity to ensure Talky is shown as online
      const activity = await db.db.chatActivity.list({
        where: { userId: 'talky-bot' },
        limit: 1
      })
      
      if (activity && activity.length > 0) {
        await db.db.chatActivity.update(activity[0].id, {
          last_activity: new Date().toISOString()
        })
      } else {
        await db.db.chatActivity.create({
          id: 'activity-talky-bot',
          userId: 'talky-bot',
          username: 'Talky',
          lastActivity: new Date().toISOString()
        })
      }
      
      return existingUser[0]
    }

    // Create Talky user
    const talkyUser = await db.db.users.create({
      id: 'talky-bot',
      username: 'Talky',
      email: 'talky@haichan.bot',
      password_hash: 'NO_PASSWORD_BOT_ACCOUNT',
      bitcoin_address: null,
      total_pow_points: 999999,
      diamond_level: 99,
      is_admin: 0,
      display_name: 'Talky AI Bot',
      email_verified: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in: new Date().toISOString()
    })

    // Create permanent activity entry
    await db.db.chatActivity.create({
      id: 'activity-talky-bot',
      user_id: 'talky-bot',
      username: 'Talky',
      last_activity: new Date().toISOString()
    })

    console.log('✓ Talky bot created successfully')
    return talkyUser
  } catch (error) {
    console.error('Failed to seed Talky bot:', error)
    throw error
  }
}
