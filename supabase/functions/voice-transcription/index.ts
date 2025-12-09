import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'openai/gpt-5-mini';
const API_KEY = Deno.env.get('LOVABLE_API_KEY');
const DEBUG = Deno.env.get('DEBUG') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, mimeType = 'audio/wav', patientId } = await req.json();

    if (!audio || typeof audio !== 'string') {
      return jsonResponse({ error: 'audio (base64) obrigatório' }, 400);
    }

    // Sanitize: remove possible data URI prefixes
    const clean = audio.replace(/^data:audio\/\w+;base64,/, '');

    // Size guardrails (20MB limit)
    const sizeBytes = Math.floor((clean.length * 3) / 4);
    if (sizeBytes > 20 * 1024 * 1024) {
      return jsonResponse({ error: 'Arquivo de áudio muito grande (>20MB)' }, 413);
    }

    if (DEBUG) {
      console.log('patientId:', patientId);
      console.log('audio length:', clean.length);
      console.log('audio size (bytes):', sizeBytes);
      console.log('audio head:', clean.slice(0, 30));
    }

    // Lovable AI Gateway payload
    const payload = {
      model: MODEL,
      input_audio: [{
        data: clean,
        mime_type: mimeType
      }],
      messages: [
        { 
          role: 'system', 
          content: 'Transcreva fielmente o áudio em português do Brasil.' 
        },
        { 
          role: 'user', 
          content: 'Transcreva o áudio enviado.' 
        }
      ],
      modalities: ['text']
    };

    const res = await fetch(LOVABLE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Handle rate limits and server errors
    if (res.status === 429 || res.status >= 500) {
      return jsonResponse({ error: `Lovable indisponível (${res.status})` }, 503);
    }

    if (!res.ok) {
      const errTxt = await res.text();
      if (DEBUG) console.error('Lovable error:', res.status, errTxt);
      return jsonResponse({ error: 'Falha na transcrição', detail: errTxt }, 400);
    }

    const data = await res.json();
    
    // Extract text from response
    const text = data?.choices?.[0]?.message?.content ?? data?.text ?? '';

    if (DEBUG) {
      console.log('Transcription success:', text.slice(0, 100));
    }

    return jsonResponse({ text }, 200);

  } catch (e) {
    console.error('Error in voice-transcription:', e);
    return jsonResponse({ error: 'Erro interno' }, 500);
  }
});

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
