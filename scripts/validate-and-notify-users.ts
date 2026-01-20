/**
 * Script to validate all users have username and email
 * Optionally sends credentials notification to users
 */

import db from '../src/lib/db-client'

async function validateAndNotifyUsers() {
  console.log('Starting user validation...')
  
  try {
    // Find all users
    const allUsers = await db.db.users.list({ limit: 10000 })
    console.log(`Total users found: ${allUsers.length}`)
    
    // Check for users missing username or email
    const incompleteUsers = allUsers.filter(user => !user.username || !user.email)
    
    if (incompleteUsers.length > 0) {
      console.warn(`\n⚠️  Found ${incompleteUsers.length} users missing username or email:`)
      incompleteUsers.forEach(u => {
        console.log(`  - ID: ${u.id}`)
        console.log(`    Username: ${u.username || 'MISSING'}`)
        console.log(`    Email: ${u.email || 'MISSING'}`)
      })
      
      console.log('\n❌ Validation failed. All users must have both username and email.')
      console.log('Please update these users before proceeding.')
      return
    }
    
    console.log('\n✓ All users have username and email!')
    
    // Optionally send credential notifications
    const shouldSendEmails = process.argv.includes('--send-emails')
    
    if (shouldSendEmails) {
      console.log('\n📧 Sending credential notifications...')
      let emailsSent = 0
      
      for (const user of allUsers) {
        if (user.email) {
          try {
            // Send email notification with credentials
            await db.notifications.sendEmail({
              to: user.email,
              subject: 'Haichan - Your Account Credentials',
              html: `
                <div style="font-family: monospace; background: #000; color: #0f0; padding: 20px;">
                  <h1 style="border-bottom: 2px solid #0f0; padding-bottom: 10px;">HAICHAN ACCOUNT CREDENTIALS</h1>
                  
                  <div style="margin: 20px 0; padding: 15px; border: 1px solid #0f0;">
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>User ID:</strong> ${user.id}</p>
                    ${user.bitcoinAddress ? `<p><strong>Bitcoin Address:</strong> ${user.bitcoinAddress}</p>` : ''}
                  </div>
                  
                  <p>Total PoW Points: ${user.totalPowPoints || 0}</p>
                  <p>Diamond Level: ${user.diamondLevel || 0}</p>
                  
                  <hr style="border-color: #0f0; margin: 20px 0;">
                  
                  <p style="font-size: 12px; color: #0a0;">
                    This is your Haichan imageboard account information.<br>
                    Visit <a href="https://haichan-pow-imageboard-7e3gh26u.sites.blink.new" style="color: #0f0;">Haichan</a> to continue mining and posting.
                  </p>
                </div>
              `,
              text: `
HAICHAN ACCOUNT CREDENTIALS

Username: ${user.username}
Email: ${user.email}
User ID: ${user.id}
${user.bitcoinAddress ? `Bitcoin Address: ${user.bitcoinAddress}\n` : ''}
Total PoW Points: ${user.totalPowPoints || 0}
Diamond Level: ${user.diamondLevel || 0}

This is your Haichan imageboard account information.
Visit https://haichan-pow-imageboard-7e3gh26u.sites.blink.new to continue mining and posting.
              `
            })
            
            emailsSent++
            console.log(`  ✓ Sent email to ${user.email}`)
          } catch (err) {
            console.error(`  ✗ Failed to send email to ${user.email}:`, err)
          }
        }
      }
      
      console.log(`\n✓ Sent ${emailsSent} credential emails`)
    } else {
      console.log('\n💡 To send credential emails to all users, run:')
      console.log('   npm run validate-users -- --send-emails')
    }
    
  } catch (error) {
    console.error('Error during validation:', error)
  }
}

validateAndNotifyUsers()
