/**
 * Script to delete all anonymous user accounts
 * Anonymous users are defined as those without both username and email
 */

import db from '../src/lib/db-client'

async function cleanupAnonymousUsers() {
  console.log('Starting cleanup of anonymous user accounts...')
  
  try {
    // Find all users
    const allUsers = await db.db.users.list({ limit: 10000 })
    console.log(`Total users found: ${allUsers.length}`)
    
    // Identify anonymous users (no username AND no email)
    const anonymousUsers = allUsers.filter(user => 
      (!user.username || user.username.trim() === '') && 
      (!user.email || user.email.trim() === '')
    )
    
    console.log(`Found ${anonymousUsers.length} anonymous users to delete`)
    
    if (anonymousUsers.length === 0) {
      console.log('No anonymous users to clean up.')
      return
    }
    
    // Delete each anonymous user
    let deleted = 0
    for (const user of anonymousUsers) {
      try {
        await db.db.users.delete(user.id)
        deleted++
        console.log(`Deleted user ${user.id}`)
      } catch (err) {
        console.error(`Failed to delete user ${user.id}:`, err)
      }
    }
    
    console.log(`\nCleanup complete: ${deleted} anonymous users deleted`)
    
    // Verify remaining users have username and email
    const remainingUsers = await db.db.users.list({ limit: 10000 })
    const incompleteUsers = remainingUsers.filter(u => !u.username || !u.email)
    
    if (incompleteUsers.length > 0) {
      console.warn(`\nWarning: ${incompleteUsers.length} users still missing username or email:`)
      incompleteUsers.forEach(u => {
        console.log(`  - ID: ${u.id}, Username: ${u.username || 'MISSING'}, Email: ${u.email || 'MISSING'}`)
      })
    } else {
      console.log('\n✓ All remaining users have username and email')
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

cleanupAnonymousUsers()
