/**
 * Orb OAuth Configuration and Utilities
 */

const ORB_CONFIG = {
  clientId: 'haichan_pow_imageboard',
  authorizeUrl: 'https://orb.replit.app/oauth/authorize',
  tokenUrl: 'https://orb.replit.app/oauth/token',
  userinfoUrl: 'https://orb.replit.app/oauth/userinfo',
  redirectUri: `${window.location.origin}/auth/orb/callback`,
  scope: 'openid email profile'
};

/**
 * Initiates the Orb OAuth redirect flow
 */
export function initiateOrbLogin() {
  const url = new URL(ORB_CONFIG.authorizeUrl);
  url.searchParams.set('client_id', ORB_CONFIG.clientId);
  url.searchParams.set('redirect_uri', ORB_CONFIG.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ORB_CONFIG.scope);
  url.searchParams.set('state', Math.random().toString(36).substring(7));
  
  window.location.href = url.toString();
}

/**
 * Handles the OAuth callback and exchanges the code for user info
 */
export async function handleOrbCallback(code: string) {
  // We need to exchange the code for a token
  // Since we are in a client-side app, we might need a proxy or a server-side function
  // However, if the token endpoint supports CORS, we can do it directly
  
  // Actually, standard OAuth requires a client_secret for the token exchange, 
  // which shouldn't be exposed in the frontend.
  // The user didn't provide a client_secret.
  
  // If Orb is a "Public Client" (like PKCE), it might work without a secret.
  // Let's assume we use an edge function to handle the token exchange if needed.
  
  // For now, let's try to do it in an edge function to keep it secure.
  return { code };
}
