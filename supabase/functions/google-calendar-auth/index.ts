import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!;
const googleScopes = Deno.env.get('GOOGLE_SCOPES')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, userId } = await req.json();

    if (action === 'getAuthUrl') {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${googleClientId}&` +
        `redirect_uri=${encodeURIComponent(googleRedirectUri)}&` +
        `scope=${encodeURIComponent(googleScopes)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchangeCode') {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: googleRedirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        throw new Error('Failed to get access token');
      }

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Encrypt tokens (simple base64 for now, use proper encryption in production)
      const accessTokenEnc = btoa(tokens.access_token);
      const refreshTokenEnc = tokens.refresh_token ? btoa(tokens.refresh_token) : null;

      // Calculate expiry date
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

      // Store connection in database
      const { data, error } = await supabase
        .from('calendar_connections')
        .upsert({
          user_id: userId,
          provider: 'google',
          provider_email: userInfo.email,
          access_token_enc: accessTokenEnc,
          refresh_token_enc: refreshTokenEnc,
          expires_at: expiresAt,
          scopes: googleScopes.split(' '),
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider',
        });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in google-calendar-auth:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});