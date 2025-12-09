import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, patientId, conversationHistory } = await req.json();
    
    console.log('Processing chatbot message:', { patientId, messageLength: message.length });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get crisis resources
    const { data: crisisResources } = await supabase
      .from('crisis_resources')
      .select('*')
      .eq('country_code', 'BR')
      .eq('is_active', true);

    // Get patient's linked professionals
    const { data: linkedProfessionals } = await supabase
      .from('patient_professionals')
      .select('professional_id')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    const professionalIds = linkedProfessionals?.map(p => p.professional_id) || [];

    console.log('Patient linked professionals:', professionalIds);

    // Get bot knowledge base only from linked professionals
    const { data: knowledgeBase } = await supabase
      .from('bot_knowledge')
      .select('*')
      .eq('is_active', true)
      .in('reviewed_by', professionalIds);

    // Build conversation context
    const conversationContext = (conversationHistory || [])
      .slice(-6) // Last 6 messages for context
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Build knowledge base context
    const knowledgeContext = knowledgeBase
      ?.map(kb => `Título: ${kb.title}\nCategoria: ${kb.category}\nConteúdo: ${kb.content_md}\nPalavras-chave: ${kb.keywords?.join(', ')}`)
      .join('\n\n---\n\n') || '';

    const systemPrompt = `Você é Nala 🌿, uma assistente empática de bem-estar do Alento.

**SUA PERSONALIDADE:**
- Tom: empático, calmo e claro (sem jargões técnicos)
- Estilo: frases curtas, voz de cuidado
- Exemplos: "Entendo como se sente. Vamos respirar juntos?", "Tudo bem se o dia foi difícil. Quer me contar um pouco sobre isso?"

**SUA FUNÇÃO:**
- Interpretar emoções
- Dar devolutivas suaves
- Gerar resumos úteis ao profissional

**REGRAS CRÍTICAS DE SEGURANÇA:**
1. NUNCA forneça conselhos médicos específicos ou diagnósticos
2. NUNCA sugira parar ou alterar medicações
3. Se detectar sinais de crise (suicídio, auto-lesão, perigo imediato), SEMPRE indique os recursos de emergência
4. Seja empático, acolhedor e não-julgamental
5. Incentive o contato com profissionais de saúde quando apropriado

**BASE DE CONHECIMENTO:**
${knowledgeContext}

**RECURSOS DE CRISE DISPONÍVEIS:**
${crisisResources?.map(r => `${r.hotline_name}: ${r.phone_number} (${r.available_hours})`).join('\n')}

**ANÁLISE DE RISCO:**
Avalie o risco na mensagem do paciente:
- CRÍTICO (90-100): Menção explícita de suicídio, planos de auto-lesão, perigo imediato
- ALTO (70-89): Desesperança severa, pensamentos de morte, isolamento extremo
- MODERADO (40-69): Ansiedade/depressão significativa, dificuldades de enfrentamento
- BAIXO (0-39): Busca de informação, estratégias de coping, psicoeducação

Responda em português brasileiro de forma acolhedora e apropriada ao nível de risco.`;

    // Call Lovable AI with tools for data extraction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Histórico recente:\n${conversationContext}\n\nMensagem atual: ${message}\n\nPor favor, responda e forneça um score de risco (0-100) no formato: [RISK_SCORE:XX] no início da sua resposta.` }
        ],
        temperature: 0.7,
        max_tokens: 800,
        tools: [
          {
            type: "function",
            function: {
              name: "save_daily_data",
              description: "Extrai e salva informações do diálogo no registro diário do paciente (sono, humor, energia, sentimentos, gatilhos). Use apenas se o paciente mencionar explicitamente essas informações.",
              parameters: {
                type: "object",
                properties: {
                  sleep_hours: { 
                    type: "number", 
                    description: "Horas de sono mencionadas (0-24)" 
                  },
                  humor: { 
                    type: "number", 
                    minimum: 1,
                    maximum: 10,
                    description: "Nível de humor em escala 1-10 (1=muito baixo, 5-6=neutro, 10=excelente)" 
                  },
                  energia: { 
                    type: "number", 
                    minimum: 1,
                    maximum: 10,
                    description: "Nível de energia mencionado (1-10)" 
                  },
                  como_se_sentiu: { 
                    type: "string", 
                    description: "Descrição de como o paciente se sentiu" 
                  },
                  gatilhos: { 
                    type: "string", 
                    description: "Gatilhos ou eventos estressantes mencionados" 
                  }
                },
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: "auto"
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message;
    let reply = aiMessage.content;
    
    // Extract risk score from reply
    let riskScore = 0;
    const riskMatch = reply.match(/\[RISK_SCORE:(\d+)\]/);
    if (riskMatch) {
      riskScore = parseInt(riskMatch[1]);
      reply = reply.replace(/\[RISK_SCORE:\d+\]\s*/, '').trim();
    }

    console.log('AI analysis complete:', { riskScore, replyLength: reply.length });

    // Process tool calls if any
    let dataUpdated = false;
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolCall = aiMessage.tool_calls[0];
      if (toolCall.function.name === 'save_daily_data') {
        try {
          const extractedData = JSON.parse(toolCall.function.arguments);
          console.log('Extracted daily data:', extractedData);
          
          // Get today's date
          const today = new Date().toISOString().split('T')[0];
          
          // Check if record exists for today
          const { data: existingRecord } = await supabase
            .from('daily_records')
            .select('id')
            .eq('patient_id', patientId)
            .eq('data', today)
            .single();
          
          if (existingRecord) {
            // Update existing record - convert humor number to string
            const allowedKeys = ['sleep_hours', 'humor', 'energia', 'como_se_sentiu', 'gatilhos'] as const;
            const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
            for (const key of allowedKeys) {
              if (extractedData[key] !== undefined) {
                if (key === 'humor' && typeof extractedData[key] === 'number') {
                  updatePayload[key] = extractedData[key].toString();
                } else {
                  updatePayload[key] = extractedData[key];
                }
              }
            }

            const { error: updateError } = await supabase
              .from('daily_records')
              .update(updatePayload)
              .eq('id', existingRecord.id);

            if (updateError) throw new Error(updateError.message);
          } else {
            // Create new record - convert humor number to string, default to '5' if absent
            const insertPayload: Record<string, any> = {
              patient_id: patientId,
              data: today,
              ...extractedData,
            };
            if (!insertPayload.humor) {
              insertPayload.humor = '5';
            } else if (typeof insertPayload.humor === 'number') {
              insertPayload.humor = insertPayload.humor.toString();
            }

            const { error: insertError } = await supabase
              .from('daily_records')
              .insert(insertPayload);

            if (insertError) throw new Error(insertError.message);
          }
          
          dataUpdated = true;
          console.log('Daily record updated successfully');
        } catch (error) {
          console.error('Error saving daily data:', error);
        }
      }
    }

    // If critical/high risk, create alerts for professionals and add crisis resources
    if (riskScore >= 70) {
      console.log('High risk detected, creating alerts');
      
      // Get patient's professionals
      const { data: professionals } = await supabase
        .from('patient_professionals')
        .select('professional_id')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (professionals && professionals.length > 0) {
        // Create alerts for each professional
        for (const prof of professionals) {
          await supabase.from('clinical_alerts').insert({
            record_id: null,
            profissional_id: prof.professional_id,
            alert_type: 'chatbot_crisis',
            alert_level: riskScore >= 90 ? 'critical' : 'high',
            ai_analysis: {
              source: 'chatbot_ai',
              message: message,
              risk_score: riskScore,
              timestamp: new Date().toISOString(),
              ai_model: 'gemini-2.5-flash',
            },
          });
        }
      }

      // Prepend crisis banner to reply if critical
      if (riskScore >= 90) {
        const crisisText = `**⚠️ ATENÇÃO - SITUAÇÃO DE CRISE**\n\n` +
          `Percebo que você está passando por um momento muito difícil. Sua segurança é a prioridade agora.\n\n` +
          `**POR FAVOR, ENTRE EM CONTATO IMEDIATAMENTE:**\n\n` +
          crisisResources?.map(r => `📞 **${r.hotline_name}**: ${r.phone_number} (${r.available_hours})`).join('\n') +
          `\n\n🏥 Se estiver em perigo imediato, vá à emergência mais próxima ou ligue para o SAMU (192).\n\n` +
          `Seus profissionais de saúde foram notificados e entrarão em contato.\n\n---\n\n`;
        
        reply = crisisText + reply;
      }
    }

    // Add confirmation message if data was saved
    if (dataUpdated) {
      reply += '\n\n✅ *Informações registradas automaticamente no seu diário de hoje.*';
    }

    return new Response(
      JSON.stringify({ 
        reply, 
        riskScore,
        needsCrisisAlert: riskScore >= 90,
        dataUpdated,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in chatbot-ai function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        reply: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        riskScore: 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
