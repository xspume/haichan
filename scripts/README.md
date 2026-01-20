# User Management Scripts

## Overview

This directory contains administrative scripts for managing users on the Haichan imageboard.

## Available Scripts

### 1. cleanup-anonymous-users.ts
**Purpose:** Delete all anonymous user accounts from the database.

**Definition of Anonymous:** Users without both username AND email.

**Usage:**
```bash
# This was already executed via SQL:
# DELETE FROM users WHERE (username IS NULL OR username = '') AND (email IS NULL OR email = '');
```

### 2. assign-usernames.ts
**Purpose:** Automatically assign usernames to users who have an email but no username.

**Logic:**
- Extracts prefix from email (part before @)
- Sanitizes special characters
- Ensures uniqueness by appending numbers if needed

**Usage:**
```bash
npm run script scripts/assign-usernames.ts
```

**Already executed via SQL:**
```sql
UPDATE users 
SET username = SUBSTR(email, 1, INSTR(email, '@') - 1)
WHERE (username IS NULL OR username = '') AND email IS NOT NULL;
```

### 3. validate-and-notify-users.ts
**Purpose:** Validate that all users have username and email, optionally send credential notifications.

**Usage:**
```bash
# Validate only
npm run script scripts/validate-and-notify-users.ts

# Validate and send emails
npm run script scripts/validate-and-notify-users.ts -- --send-emails
```

**Features:**
- Lists users missing username or email
- Sends beautifully formatted emails with account credentials
- Includes PoW points, diamond level, and Bitcoin address

## Database Changes

### Anonymous Posting Feature

**New Functionality:**
- Users can now post threads and replies anonymously
- Checkbox option added to:
  - `NewThreadPage.tsx`
  - `NewReplyPage.tsx`
  - `QuickReplyForm.tsx`
- When checked, username is set to "Anonymous" regardless of user's actual username

### User Requirements

**All users MUST have:**
- ✅ Username (unique identifier)
- ✅ Email (for notifications and account recovery)

**Anonymous accounts (no username AND no email) have been deleted.**

## Email Notification Format

When sending credential emails, users receive:
- Username
- Email address
- User ID
- Bitcoin address (if configured)
- Total PoW points
- Diamond level

The email is styled with a terminal/monospace aesthetic matching the Haichan theme.

## Verification

Check user status:
```sql
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN username IS NULL OR username = '' THEN 1 ELSE 0 END) as missing_username,
  SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) as missing_email
FROM users;
```

Expected result:
- `missing_username: 0`
- `missing_email: 0`
