import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://orb.replit.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "haichan_pow_imageboard",
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(JSON.stringify({ error: "Token exchange failed", details: errorText }), {
        status: tokenResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userinfoResponse = await fetch("https://orb.replit.app/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userinfoResponse.ok) {
      const errorText = await userinfoResponse.text();
      return new Response(JSON.stringify({ error: "Userinfo fetch failed", details: errorText }), {
        status: userinfoResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = await userinfoResponse.json();

    return new Response(JSON.stringify(userData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
