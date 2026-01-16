import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^0.18.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      "Content-Type": "application/json",
    };

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: currentCorsHeaders,
      });
    }

    const { username } = await req.json();

    if (!username) {
      return new Response(JSON.stringify({ error: "Username required" }), {
        status: 400,
        headers: currentCorsHeaders,
      });
    }

    const blink = createClient({
      projectId: Deno.env.get("BLINK_PROJECT_ID")!,
      secretKey: Deno.env.get("BLINK_SECRET_KEY")!,
    });

    console.log(`[get-user-by-username] Looking up user: ${username}`);

    // Try username lookup first (case insensitive for username)
    const usernameLower = username.toLowerCase();
    let users = await blink.db.users.list({
      where: { username: usernameLower },
      limit: 1,
    });

    // If not found, try bitcoin_address lookup (case sensitive)
    if (users.length === 0) {
      console.log(`[get-user-by-username] Username ${usernameLower} not found, checking bitcoin_address: ${username}`);
      users = await blink.db.users.list({
        where: { bitcoin_address: username },
        limit: 1,
      });
    }

    if (users.length === 0) {
      console.warn(`[get-user-by-username] User ${username} not found in DB`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: currentCorsHeaders,
      });
    }

    console.log(`[get-user-by-username] User found: ${users[0].username} (${users[0].email})`);

    // Only return public info if needed, but here we need email for login
    return new Response(JSON.stringify({ user: { email: users[0].email, username: users[0].username } }), {
      status: 200,
      headers: currentCorsHeaders,
    });
  } catch (error: any) {
    console.error(`[get-user-by-username] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});