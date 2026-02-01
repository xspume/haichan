import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^2.3.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Blink Client with Secret Key for Admin Access
const blink = createClient({
  projectId: Deno.env.get('BLINK_PROJECT_ID')!,
  secretKey: Deno.env.get('BLINK_SECRET_KEY')!,
});

/**
 * PoW prefix presets and validation
 */
const POW_PRESETS = {
  STANDARD: { prefix: '21e8', points: 15 },
  HARD: { prefix: '21e80', points: 60 },
  VERY_HARD: { prefix: '21e800', points: 240 },
  EXTREME: { prefix: '21e8000', points: 960 },
  LEGENDARY: { prefix: '21e80000', points: 3840 },
} as const;

/**
 * Server-enforced minimum PoW requirement
 * Default: STANDARD (21e8) to prevent client from cheating
 */
const MINIMUM_POW_PREFIX = POW_PRESETS.STANDARD.prefix;
const MINIMUM_POW_POINTS = POW_PRESETS.STANDARD.points;

interface ValidationRequest {
  shares?: Array<{
    hash: string;
    nonce: string;
    points: number;
    trailingZeros: number;
    challenge: string;
    prefix?: string;
  }>;
  challenge?: string;
  nonce?: string;
  hash?: string;
  prefix?: string;
  points?: number;
  trailingZeros?: number;
  targetType: 'board' | 'thread' | 'post' | 'blog' | 'global' | 'image';
  targetId?: string;
  userId?: string;
  // Optional post data for secure creation
  createPostData?: {
    boardId?: string;
    threadId?: string;
    title?: string;
    content: string;
    imageUrl?: string;
    username?: string;
    tripcode?: string;
    countryCode?: string;
    postAnonymously?: boolean;
  };
}

interface ValidationResponse {
  valid: boolean;
  error?: string;
  verifiedHash?: string; // For single
  verifiedPrefix?: string;
  verifiedPoints?: number; // Total points for batch
  verifiedTrailingZeros?: number;
  dbUpdated?: boolean;
  totalPoints?: number; // Total points added
  postNumber?: number; // New post number if post created
  postId?: string; // ID of the created post
}

/**
 * Verify that a hash meets the required prefix
 */
function verifyHashPrefix(hash: string, prefix: string): boolean {
  return hash.startsWith(prefix);
}

/**
 * Count zeros after the prefix
 */
function countTrailingZeros(hash: string, prefix: string): number {
  if (!hash.startsWith(prefix)) return 0;
  
  let count = 0;
  for (let i = prefix.length; i < hash.length; i++) {
    if (hash[i] === '0') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Detect the best matching PoW prefix from a hash
 * Returns the highest-value prefix that the hash matches
 */
function detectHashPrefix(hash: string, requiredPrefix?: string): { prefix: string; basePoints: number } | null {
  const basePrefix = '21e8';
  
  // Enforce minimum requirement of 21e8
  if (!hash.startsWith(basePrefix)) {
    console.warn(`[detectHashPrefix] Hash ${hash.substring(0, 8)}... does not start with ${basePrefix}`);
    return null;
  }

  // If a specific prefix was requested, ensure the hash matches it
  if (requiredPrefix && !hash.startsWith(requiredPrefix)) {
    console.warn(`[detectHashPrefix] Hash ${hash.substring(0, 8)}... does not match required prefix ${requiredPrefix}`);
    return null;
  }

  return { prefix: basePrefix, basePoints: 15 };
}

/**
 * Verify that a hash was correctly computed from challenge + nonce
 * Uses Web Crypto API for consistency with browser worker implementation
 */
async function verifyHash(challenge: string, nonce: string, expectedHash: string): Promise<boolean> {
  const data = challenge + nonce;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Use Web Crypto API (SubtleCrypto) which matches browser implementation
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === expectedHash;
}

/**
 * Validate PoW submission against server-side rules and apply to database
 */
async function validateAndApplyPoW(request: ValidationRequest): Promise<ValidationResponse> {
  const { targetType, targetId, userId, createPostData } = request;

  // Fetch site settings
  let siteSettings: any = null;
  try {
    siteSettings = await blink.db.siteSettings.get('singleton');
  } catch (e) {
    console.error('Failed to fetch site settings:', e);
  }

  const diamondBoost = Number(siteSettings?.diamondBoost) || 1.0;
  const maintenanceMode = Number(siteSettings?.maintenanceMode) > 0;

  // Maintenance Mode Check
  if (maintenanceMode && userId) {
    try {
      const user = await blink.db.users.get(userId);
      if (!user || (Number(user.isAdmin) === 0 && user.username !== 'jcb')) {
        return { valid: false, error: 'Site is in maintenance mode. Actions restricted.' };
      }
    } catch (e) {
      console.error('Failed to check admin status for maintenance mode:', e);
    }
  }

  // Normalize input to array of shares
  const sharesToValidate = request.shares || (request.hash && request.nonce && request.challenge ? [{
    challenge: request.challenge,
    nonce: request.nonce,
    hash: request.hash,
    points: request.points || 0,
    trailingZeros: request.trailingZeros || 0,
    prefix: request.prefix
  }] : []);

  if (sharesToValidate.length === 0) {
      return { valid: false, error: 'No shares provided' };
  }

  let totalValidPoints = 0;
  const validRecords: any[] = [];
  let maxTrailingZeros = 0;
  let bestHash = '';

  for (const share of sharesToValidate) {
    // Detect the actual prefix from the hash (not claimed prefix)
    const basePrefix = '21e8';
    
    // 0. CHECK FOR REPLAY ATTACK (CRITICAL)
    // Check if this hash/nonce combination has already been used
    const existingRecords = await blink.db.powRecords.list({
      where: { hash: share.hash, nonce: share.nonce },
      limit: 1
    });
    
    if (existingRecords && existingRecords.length > 0) {
      console.warn(`[validate-pow] REPLAY DETECTED: Hash ${share.hash.substring(0, 10)} has already been used.`);
      continue;
    }

    // 1. Verify hash was correctly computed
    const isHashValid = await verifyHash(share.challenge, share.nonce, share.hash);
    if (!isHashValid) {
          console.warn(`[validate-pow] Hash verification failed for share. Hash: ${share.hash.substring(0, 10)}... Challenge: ${share.challenge.substring(0, 10)}... Nonce: ${share.nonce.substring(0, 10)}...`);
          continue; // Skip invalid shares
        }

        // 2. Detect the actual prefix from the hash (not claimed prefix)
        // Pass the claimed prefix from the share if available to ensure it matches
        const detected = detectHashPrefix(share.hash, share.prefix || request.prefix);
        if (!detected) {
          console.warn(`[validate-pow] No valid prefix detected for hash: ${share.hash.substring(0, 16)}... (Required: ${share.prefix || request.prefix || '21e8'})`);
          continue;
        }

        // 3. Enforce minimum prefix requirement (must at least be '21e8')
        if (!share.hash.startsWith('21e8')) {
          console.warn(`[validate-pow] Hash does not meet minimum prefix 21e8: ${share.hash.substring(0, 10)}... (Starts with: ${share.hash.substring(0, 4)})`);
          continue;
        }

        // 4. Use 21e8 as base for all calculations to ensure consistency with "Leading Zeros" logic
        const sharePrefix = '21e8';
        
        // 5. Count zeros after the 21e8 prefix
        const verifiedTrailingZeros = countTrailingZeros(share.hash, sharePrefix);
        
        // 6. Calculate points (15 * 4^zeros)
        const verifiedPoints = 15 * Math.pow(4, verifiedTrailingZeros);
        
        totalValidPoints += verifiedPoints;
        
        if (verifiedTrailingZeros > maxTrailingZeros) {
            maxTrailingZeros = verifiedTrailingZeros;
            bestHash = share.hash;
        }

        validRecords.push({
          id: `pow_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          userId: userId!,
          targetType,
          targetId: targetId || 'global',
          challenge: share.challenge,
          nonce: share.nonce,
          hash: share.hash,
          points: verifiedPoints,
          trailingZeros: verifiedTrailingZeros,
          isDiamond: share.hash.startsWith('21e80000') ? 1 : 0,
        });
  }

  if (validRecords.length === 0) {
      console.error(`[validate-pow] Batch validation failed: none of the ${sharesToValidate.length} shares were valid. (Required prefix: ${request.prefix || '21e8'})`);
      return { valid: false, error: 'No valid shares found in batch. Verification failed.' };
  }

  // 6. Apply to Database
  try {
    let createdPostId: string | undefined;
    let newPostNumber: number | undefined;

    // A. Handle Post/Thread Creation if requested
    if (createPostData && (targetType === 'post' || targetType === 'thread')) {
      console.log(`[validate-pow] Securely creating ${targetType}...`);
      
      // 1. Get next post number atomically
      let sequenceId = '1';
      let sequenceResult = await blink.db.postSequence.list({ limit: 1 });
      let currentNumber = 100;
      
      if (sequenceResult.length === 0) {
        await blink.db.postSequence.create({ id: sequenceId, currentNumber: 101 });
        currentNumber = 101;
      } else {
        sequenceId = sequenceResult[0].id;
        currentNumber = Number(sequenceResult[0].currentNumber) + 1;
        await blink.db.postSequence.update(sequenceId, { currentNumber });
      }
      
      newPostNumber = currentNumber;
      
      // 2. Create the record
      const timestamp = new Date().toISOString();
      
      // Ensure threads ALWAYS have an image (IMAGEBOARD rule)
      if (targetType === 'thread' && (!createPostData.imageUrl || createPostData.imageUrl.trim() === '')) {
        return { valid: false, error: 'Image is mandatory for new threads on this imageboard.' };
      }

      const commonData = {
        userId: userId!,
        username: createPostData.username || 'Anonymous',
        content: createPostData.content,
        imageUrl: createPostData.imageUrl || '',
        postNumber: currentNumber,
        countryCode: createPostData.countryCode || '',
        totalPow: totalValidPoints,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (createPostData.tripcode) (commonData as any).tripcode = createPostData.tripcode;

      if (targetType === 'thread') {
        const thread = await blink.db.threads.create({
          ...commonData,
          boardId: createPostData.boardId!,
          title: createPostData.title || 'Untitled',
          replyCount: 0,
          bumpOrder: Math.floor(Date.now() / 1000),
          lastPostAt: timestamp,
          expired: 0
        });
        createdPostId = thread.id;
      } else {
        const post = await blink.db.posts.create({
          ...commonData,
          threadId: createPostData.threadId!,
        });
        createdPostId = post.id;
        
        // Update thread bump and reply count
        const thread = await blink.db.threads.get(createPostData.threadId!);
        if (thread) {
          await blink.db.threads.update(createPostData.threadId!, {
            replyCount: (Number(thread.replyCount) || 0) + 1,
            lastPostAt: timestamp,
            bumpOrder: Math.floor(Date.now() / 1000),
            updatedAt: timestamp
          });
        }
      }
      
      // Update validRecords with the new targetId
      validRecords.forEach(r => r.targetId = createdPostId);
    }

    // Bulk Insert Records
    if (userId && validRecords.length > 0) {
      // Use createMany for high performance batch insertion
      // This prevents "Application failed to respond" errors from too many concurrent requests
      await blink.db.powRecords.createMany(validRecords);
    }

    // Update User Total PoW
    if (userId) {
      const user = await blink.db.users.get(userId);
      if (user) {
        await blink.db.users.update(userId, {
          totalPowPoints: (user.totalPowPoints || 0) + totalValidPoints
        });

        // Handle Diamond Achievements
        if (maxTrailingZeros > 0) {
           const allAchievements = await blink.db.achievements.list({
             where: { userId: userId }
           });
           
           const existing = allAchievements?.find((a: any) => Number(a.level) === maxTrailingZeros);
           
           if (!existing) {
             await blink.db.achievements.create({
               id: `ach_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
               userId: userId,
               level: maxTrailingZeros,
               hash: bestHash
             });
           }
           
           const maxLevel = Math.max(
             ...(allAchievements?.map((a: any) => Number(a.level) || 0) || []),
             maxTrailingZeros,
             0
           );
           
           if (maxLevel > (user.diamondLevel || 0)) {
             await blink.db.users.update(userId, {
               diamondLevel: maxLevel
             });
           }
        }
      }
    }

    // Update Target Total PoW
    if (targetId) {
      let table: any = null;
      if (targetType === 'board') table = blink.db.boards;
      if (targetType === 'thread') table = blink.db.threads;
      if (targetType === 'post') table = blink.db.posts;
      if (targetType === 'blog') table = blink.db.blogPosts;
      if (targetType === 'image') table = blink.db.imageMetadata;

      if (table) {
        const item = await table.get(targetId);
        if (item) {
           const updateData: any = {
             totalPow: (Number(item.totalPow) || 0) + totalValidPoints
           };

           // For threads, update bump order to keep them fresh
           if (targetType === 'thread') {
             updateData.bumpOrder = Math.floor(Date.now() / 1000);
             updateData.updatedAt = new Date().toISOString();
           }
           
           await table.update(targetId, updateData);
           
           if (targetType === 'board') {
             await table.update(targetId, { lastActivityAt: new Date().toISOString() });
           }

          // Propagate PoW to parents (Thread -> Board, Post -> Thread -> Board)
          
          // 1. If target is Thread, update Board
          if (targetType === 'thread' && item.boardId) {
            const board = await blink.db.boards.get(item.boardId);
            if (board) {
              await blink.db.boards.update(item.boardId, {
                totalPow: (Number(board.totalPow) || 0) + totalValidPoints,
                lastActivityAt: new Date().toISOString()
              });
            }
          }

          // 2. If target is Post, update Thread and Board
          if (targetType === 'post' && item.threadId) {
            const thread = await blink.db.threads.get(item.threadId);
            if (thread) {
              // Update Thread
              await blink.db.threads.update(item.threadId, {
                totalPow: (Number(thread.totalPow) || 0) + totalValidPoints,
                bumpOrder: Math.floor(Date.now() / 1000), 
                updatedAt: new Date().toISOString()
              });

              // Update Board
              if (thread.boardId) {
                const board = await blink.db.boards.get(thread.boardId);
                if (board) {
                  await blink.db.boards.update(board.id, {
                    totalPow: (Number(board.totalPow) || 0) + totalValidPoints,
                    lastActivityAt: new Date().toISOString()
                  });
                }
              }
            }
          }
       }
     }
   }

    // 7. Broadcast Realtime Update
    try {
      await blink.realtime.publish('global-stats-updates', 'stats-updated', {
        pointsAdded: totalValidPoints,
        userId: userId,
        targetType: targetType,
        targetId: targetId,
        timestamp: Date.now()
      });
    } catch (rtError) {
      console.error('Realtime broadcast failed:', rtError);
      // Continue execution - don't fail the request just because realtime failed
    }

    return {
      valid: true,
      verifiedPoints: totalValidPoints,
      totalPoints: totalValidPoints,
      dbUpdated: true,
      postId: createdPostId,
      postNumber: newPostNumber
    };

  } catch (dbError: any) {
    console.error('Database update failed:', dbError);
    return {
      valid: true,
      error: 'PoW Valid but DB update failed: ' + dbError.message,
      dbUpdated: false,
      verifiedPoints: totalValidPoints 
    };
  }
}

serve(async (req) => {
  const allowedOrigins = [
    'https://haichan-pow-imageboard-7e3gh26u.sites.blink.new',
    'https://hai-chan.org',
    'https://haichan.co'
  ];
  const origin = req.headers.get('origin');
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const currentCorsHeaders = {
    ...corsHeaders,
    'Access-Control-Allow-Origin': corsOrigin,
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: currentCorsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: ValidationRequest = await req.json();

    // Validate required fields
    // For batch, we just need shares array or the legacy fields
    if (!body.shares && (!body.challenge || !body.nonce || !body.hash)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: shares OR (challenge, nonce, hash)' }),
        { status: 400, headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  // Perform validation and DB update
  console.log(`[validate-pow] Validating PoW from user ${body.userId} for ${body.targetType}:${body.targetId}`);
  const result = await validateAndApplyPoW(body);

  if (!result.valid) {
    console.warn(`[validate-pow] Validation failed: ${result.error}`, { 
      challenge: body.challenge, 
      nonce: body.nonce, 
      hash: body.hash 
    });
    return new Response(
        JSON.stringify({ valid: false, error: result.error }),
        { status: 400, headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return successful validation
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating PoW:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});