import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!;

// Simple XOR encryption for LGPD compliance
function encrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function redactPII(text: string): string {
  // Remove common PII patterns
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REDACTED]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ_REDACTED]');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { summaryId } = await req.json();
    
    if (!summaryId) {
      throw new Error('Summary ID is required');
    }

    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    console.log('Processing summary request:', summaryId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get summary request details
    const { data: summary, error: summaryError } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();

    if (summaryError || !summary) {
      throw new Error('Summary not found');
    }

    console.log('Found summary request:', summary);

    // Fetch patient data for the period
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select(`
        *,
        daily_records(
          id,
          data,
          humor,
          sleep_hours,
          energia,
          como_se_sentiu,
          gatilhos,
          observacoes_profissional,
          sinal_alerta
        ),
        questionnaire_responses(
          response_value,
          answered_at,
          questionnaire_questions(question_text, risk_threshold)
        )
      `)
      .eq('id', summary.patient_id)
      .gte('daily_records.data', summary.period_start)
      .lte('daily_records.data', summary.period_end);

    if (patientError) {
      throw new Error('Failed to fetch patient data');
    }

    console.log('Fetched patient data for analysis');

    // Prepare data for AI analysis
    // Prepare data for AI analysis
    const records = patientData?.[0]?.daily_records || [];
    const questionnaires = patientData?.[0]?.questionnaire_responses || [];
    let alerts: any[] = [];

    try {
      const recordIds = records.map((r: any) => r.id).filter(Boolean);
      if (recordIds.length > 0) {
        const { data: alertsData, error: alertsError } = await supabase
          .from('clinical_alerts')
          .select('alert_level, alert_type, created_at, ai_analysis, record_id')
          .in('record_id', recordIds);
        if (!alertsError && alertsData) alerts = alertsData;
      }
    } catch (e) {
      console.warn('Não foi possível buscar alertas clínicos:', e);
    }

    const analysisData = {
      period: {
        start: summary.period_start,
        end: summary.period_end
      },
      records,
      medications: [],
      questionnaires,
      alerts
    };

    // Generate AI summary
    const prompt = `
Você é um assistente clínico especializado em saúde mental. Analise os dados do paciente para o período de ${summary.period_start} a ${summary.period_end} e gere um resumo estruturado seguindo EXATAMENTE o formato JSON especificado.

Dados do paciente:
- Registros diários: ${JSON.stringify(analysisData.records)}
- Medicações: ${JSON.stringify(analysisData.medications)}
- Questionários: ${JSON.stringify(analysisData.questionnaires)}
- Alertas: ${JSON.stringify(analysisData.alerts)}

IMPORTANTE: Responda APENAS com um JSON válido seguindo esta estrutura exata:

{
  "timeline": "Cronologia dos principais eventos e mudanças no período",
  "key_changes": "Principais alterações observadas em humor, sono, energia e sintomas",
  "red_flags": "Sinais de alerta, episódios críticos ou fatores de risco identificados",
  "adherence": "Análise da aderência medicamentosa e padrões de comportamento",
  "next_steps": "Recomendações para o próximo período e pontos de atenção"
}

Mantenha o resumo profissional, objetivo e focado em insights clínicos relevantes. Evite informações pessoais identificáveis.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente clínico que gera resumos estruturados de dados de pacientes. Responda sempre em formato JSON válido.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Lovable AI API error:', errorData);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos esgotados. Adicione créditos ao workspace.');
      }
      
      throw new Error(`Lovable AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = Number(data.usage?.total_tokens ?? 0);

    console.log('Generated summary content:', generatedContent);

    // Remove markdown code block markers if present
    let cleanContent = generatedContent.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse the JSON response
    let sectionsJson;
    try {
      sectionsJson = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', cleanContent);
      // Fallback to a structured format
      sectionsJson = {
        timeline: cleanContent.substring(0, 500),
        key_changes: "Falha na análise automática",
        red_flags: "Revisão manual necessária",
        adherence: "Dados insuficientes",
        next_steps: "Consultar profissional responsável"
      };
    }

    // Encrypt and redact content for LGPD compliance
    const encryptedContent = encrypt(generatedContent, encryptionKey);
    const redactedContent = redactPII(generatedContent);

    // Update summary with generated content
    const { error: updateError } = await supabase
      .from('ai_summaries')
      .update({
        sections_json: sectionsJson,
        tokens_used: tokensUsed,
        status: 'completed',
        encrypted_content: encryptedContent,
        redacted_content: redactedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', summaryId);

    if (updateError) {
      throw new Error('Failed to update summary');
    }

    // Record usage in ledger
    const { error: usageError } = await supabase
      .from('ai_usage_ledger')
      .insert({
        user_id: summary.generated_by,
        feature: 'summary_generation',
        tokens: tokensUsed,
        cost_cents: Math.round(tokensUsed * 0.002), // Approximate cost calculation
        patient_id: summary.patient_id,
        metadata: {
          summary_id: summaryId,
          summary_type: summary.summary_type,
          model: 'google/gemini-2.5-flash'
        }
      });

    if (usageError) {
      console.error('Failed to record usage:', usageError);
    }

    console.log('Summary generation completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      summaryId,
      tokensUsed,
      sections: sectionsJson
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-patient-summary function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Summary generation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});