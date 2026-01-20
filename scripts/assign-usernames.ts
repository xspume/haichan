/**
 * Script to assign usernames to users who don't have one
 * Uses email prefix or generates a unique username
 */

import db from '../src/lib/db-client'

function generateUsernameFromEmail(email: string): string {
  // Extract part before @
  const prefix = email.split('@')[0]
  // Remove special characters, keep only alphanumeric and underscore
  const cleaned = prefix.replace(/[^a-zA-Z0-9_]/g, '_')
  return cleaned || 'user'
}

async function assignUsernames() {
  console.log('Starting username assignment...')
  
  try {
    // Find users without username
    const allUsers = await db.db.users.list({ limit: 10000 })
    const usersWithoutUsername = allUsers.filter(user => !user.username || user.username.trim() === '')
    
    console.log(`Found ${usersWithoutUsername.length} users without username`)
    
    if (usersWithoutUsername.length === 0) {
      console.log('✓ All users already have usernames!')
      return
    }
    
    // Get existing usernames to avoid duplicates
    const existingUsernames = new Set(
      allUsers
        .filter(u => u.username && u.username.trim() !== '')
        .map(u => u.username.toLowerCase())
    )
    
    let updated = 0
    for (const user of usersWithoutUsername) {
      if (!user.email) {
        console.warn(`  ⚠️  User ${user.id} has no email, skipping...`)
        continue
      }
      
      // Generate base username from email
      let baseUsername = generateUsernameFromEmail(user.email)
      let username = baseUsername
      let suffix = 1
      
      // Make it unique if needed
      while (existingUsernames.has(username.toLowerCase())) {
        username = `${baseUsername}${suffix}`
        suffix++
      }
      
      try {
        await db.db.users.update(user.id, { username })
        existingUsernames.add(username.toLowerCase())
        updated++
        console.log(`  ✓ Assigned username "${username}" to ${user.email}`)
      } catch (err) {
        console.error(`  ✗ Failed to update user ${user.id}:`, err)
      }
    }
    
    console.log(`\n✓ Assigned usernames to ${updated} users`)
    
    // Verify all users now have usernames
    const verifyUsers = await db.db.users.list({ limit: 10000 })
    const stillMissing = verifyUsers.filter(u => !u.username || !u.email)
    
    if (stillMissing.length > 0) {
      console.warn(`\n⚠️  ${stillMissing.length} users still missing username or email`)
    } else {
      console.log('\n✓ All users now have username and email!')
    }
    
  } catch (error) {
    console.error('Error during assignment:', error)
  }
}

assignUsernames()
