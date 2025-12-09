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

interface AppointmentData {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  telemedicine_link?: string;
  patient_name?: string;
}

async function refreshAccessToken(refreshTokenEnc: string): Promise<string | null> {
  try {
    const refreshToken = atob(refreshTokenEnc);
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    
    if (data.access_token) {
      return data.access_token;
    }
    
    console.error('Failed to refresh token:', data);
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

async function getValidAccessToken(userId: string): Promise<{ token: string; connectionId: string } | null> {
  const { data: connection, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (error || !connection) {
    console.log('No calendar connection found for user:', userId);
    return null;
  }

  const now = new Date();
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  
  // Check if token is expired or will expire in 5 minutes
  if (expiresAt && expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');
    
    if (!connection.refresh_token_enc) {
      console.error('No refresh token available');
      return null;
    }
    
    const newAccessToken = await refreshAccessToken(connection.refresh_token_enc);
    
    if (newAccessToken) {
      // Update the stored token
      const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      await supabase
        .from('calendar_connections')
        .update({
          access_token_enc: btoa(newAccessToken),
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id);
      
      return { token: newAccessToken, connectionId: connection.id };
    }
    
    return null;
  }

  return { token: atob(connection.access_token_enc), connectionId: connection.id };
}

async function createGoogleEvent(accessToken: string, appointment: AppointmentData): Promise<string | null> {
  const description = [
    appointment.description,
    appointment.patient_name ? `Paciente: ${appointment.patient_name}` : null,
    appointment.telemedicine_link ? `Link: ${appointment.telemedicine_link}` : null
  ].filter(Boolean).join('\n\n');

  const event = {
    summary: appointment.title,
    description: description || undefined,
    location: appointment.location || undefined,
    start: {
      dateTime: appointment.start_time,
      timeZone: 'America/Sao_Paulo'
    },
    end: {
      dateTime: appointment.end_time,
      timeZone: 'America/Sao_Paulo'
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'email', minutes: 60 }
      ]
    }
  };

  console.log('Creating Google Calendar event:', JSON.stringify(event));

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Failed to create Google event:', data);
    return null;
  }

  console.log('Google event created with ID:', data.id);
  return data.id;
}

async function updateGoogleEvent(accessToken: string, eventId: string, appointment: AppointmentData): Promise<boolean> {
  const description = [
    appointment.description,
    appointment.patient_name ? `Paciente: ${appointment.patient_name}` : null,
    appointment.telemedicine_link ? `Link: ${appointment.telemedicine_link}` : null
  ].filter(Boolean).join('\n\n');

  const event = {
    summary: appointment.title,
    description: description || undefined,
    location: appointment.location || undefined,
    start: {
      dateTime: appointment.start_time,
      timeZone: 'America/Sao_Paulo'
    },
    end: {
      dateTime: appointment.end_time,
      timeZone: 'America/Sao_Paulo'
    }
  };

  console.log('Updating Google Calendar event:', eventId);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const data = await response.json();
    console.error('Failed to update Google event:', data);
    return false;
  }

  console.log('Google event updated successfully');
  return true;
}

async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<boolean> {
  console.log('Deleting Google Calendar event:', eventId);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 410) { // 410 means already deleted
    console.error('Failed to delete Google event, status:', response.status);
    return false;
  }

  console.log('Google event deleted successfully');
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, appointment, appointmentId } = await req.json();
    
    console.log(`Processing ${action} for user ${userId}, appointment ${appointmentId || appointment?.id}`);

    // Get valid access token
    const tokenResult = await getValidAccessToken(userId);
    
    if (!tokenResult) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No valid Google Calendar connection found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token: accessToken, connectionId } = tokenResult;

    if (action === 'create') {
      const googleEventId = await createGoogleEvent(accessToken, appointment);
      
      if (googleEventId) {
        // Store the link
        await supabase.from('calendar_event_links').insert({
          appointment_id: appointment.id,
          calendar_connection_id: connectionId,
          provider_event_id: googleEventId,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        });

        return new Response(JSON.stringify({ success: true, googleEventId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ success: false, error: 'Failed to create event' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      // Find existing link
      const { data: link } = await supabase
        .from('calendar_event_links')
        .select('*')
        .eq('appointment_id', appointment.id)
        .maybeSingle();

      if (link) {
        const success = await updateGoogleEvent(accessToken, link.provider_event_id, appointment);
        
        if (success) {
          await supabase
            .from('calendar_event_links')
            .update({ 
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced'
            })
            .eq('id', link.id);
        }

        return new Response(JSON.stringify({ success }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // No existing link - create new event
        const googleEventId = await createGoogleEvent(accessToken, appointment);
        
        if (googleEventId) {
          await supabase.from('calendar_event_links').insert({
            appointment_id: appointment.id,
            calendar_connection_id: connectionId,
            provider_event_id: googleEventId,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          });

          return new Response(JSON.stringify({ success: true, googleEventId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      return new Response(JSON.stringify({ success: false, error: 'Failed to update event' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const { data: link } = await supabase
        .from('calendar_event_links')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (link) {
        const success = await deleteGoogleEvent(accessToken, link.provider_event_id);
        
        if (success) {
          await supabase
            .from('calendar_event_links')
            .delete()
            .eq('id', link.id);
        }

        return new Response(JSON.stringify({ success }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No link found - nothing to delete from Google
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-calendar-sync:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
