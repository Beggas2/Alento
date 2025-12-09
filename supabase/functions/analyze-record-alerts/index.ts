import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para criptografia simples (em produção, use uma biblioteca mais robusta)
function encrypt(text: string, key: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key);
  
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

function decrypt(encryptedText: string, key: string): string {
  const encrypted = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
  const keyData = new TextEncoder().encode(key);
  
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyData[i % keyData.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== INÍCIO DA ANÁLISE DE ALERTAS ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Supabase URL:', Deno.env.get('SUPABASE_URL') ? 'configurado' : 'não configurado');
    console.log('Service Role Key:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'configurado' : 'não configurado');
    console.log('Gemini API Key:', Deno.env.get('GEMINI_API_KEY') ? 'configurado' : 'não configurado');

    const body = await req.json();
    console.log('Body recebido:', JSON.stringify(body));

    const { recordId, patientText, patientId } = body;
    
    if (!recordId || !patientText || !patientId) {
      console.error('Parâmetros faltando:', { recordId, patientText: !!patientText, patientId });
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios faltando',
        missing: {
          recordId: !recordId,
          patientText: !patientText,
          patientId: !patientId
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Analisando registro:', recordId, 'para paciente:', patientId);
    console.log('Texto do paciente:', patientText);

    // Chave de criptografia (em produção, use uma chave mais segura)
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key-for-demo';
    
    // Criptografar dados sensíveis antes de enviar para IA
    const encryptedText = encrypt(patientText, encryptionKey);
    
    // Descriptografar para análise (simulação - em produção a IA receberia dados criptografados)
    const textToAnalyze = decrypt(encryptedText, encryptionKey);
    
    console.log('Texto criptografado e descriptografado com sucesso');

    // Verificar se a API Key do Gemini existe
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    console.log('Fazendo chamada para API Gemini...');
    
    // Análise com Gemini API - usar modelo compatível com v1beta
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    console.log('URL Gemini:', geminiUrl.replace(geminiApiKey, '[HIDDEN]'));

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `Analise o seguinte texto de um registro médico e identifique sinais de alerta para risco de autolesão, suicídio ou crises psicológicas graves. 

            Texto para análise: "${textToAnalyze}"
            
            Responda APENAS com um JSON no seguinte formato:
            {
              "hasAlert": true/false,
              "alertLevel": "baixo/medio/alto",
              "alertType": "suicidio/autolesao/crise/depressao/ansiedade_severa",
              "keyWords": ["palavra1", "palavra2"],
              "recommendation": "recomendação específica para o profissional"
            }
            
            Critérios para alerta:
            - Alto: menções diretas de suicídio, autolesão, desejo de morrer
            - Médio: tristeza profunda, desesperança, isolamento social extremo
            - Baixo: sintomas de ansiedade ou depressão leve
            
            Se não há sinais de alerta, retorne hasAlert: false.`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    });

    console.log('Status da resposta Gemini:', geminiResponse.status);
    console.log('Headers da resposta Gemini:', Object.fromEntries(geminiResponse.headers.entries()));

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Erro na API Gemini:', errorText);
      throw new Error(`Erro na API Gemini: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Resposta do Gemini:', JSON.stringify(geminiData, null, 2));

    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('Resposta inválida da API Gemini');
    }

    const analysisText = geminiData.candidates[0].content.parts[0].text;
    
    // Parse da resposta JSON
    let analysisResult;
    try {
      // Extrair JSON da resposta
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON não encontrado na resposta');
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta:', parseError);
      // Fallback: análise manual básica
      analysisResult = {
        hasAlert: false,
        alertLevel: "baixo",
        alertType: "sem_risco",
        keyWords: [],
        recommendation: "Análise automática não foi possível"
      };
    }

    console.log('Resultado da análise:', analysisResult);

    // Se há alerta, criar alerta clínico
    if (analysisResult.hasAlert) {
      // Primeiro, remover alertas existentes para este record_id para evitar duplicatas
      const { error: deleteError } = await supabaseClient
        .from('clinical_alerts')
        .delete()
        .eq('record_id', recordId);
      
      if (deleteError) {
        console.error('Erro ao deletar alertas existentes:', deleteError);
      }

      // Buscar profissionais vinculados ao paciente
      const { data: professionals, error: profError } = await supabaseClient
        .from('patient_professionals')
        .select('professional_id')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (profError) {
        console.error('Erro ao buscar profissionais:', profError);
      } else if (professionals && professionals.length > 0) {
        console.log(`Encontrados ${professionals.length} profissionais vinculados ao paciente ${patientId}`);
        
        // Preparar alertas para inserção em lote
        const alertsToInsert = professionals.map(prof => ({
          record_id: recordId,
          profissional_id: prof.professional_id,
          alert_type: analysisResult.alertType,
          alert_level: analysisResult.alertLevel,
          ai_analysis: JSON.stringify({
            keyWords: analysisResult.keyWords,
            recommendation: analysisResult.recommendation,
            confidence: analysisResult.confidence || 'medium'
          }),
          visualizado: false
        }));

        // Inserir todos os alertas de uma vez
        const { error: alertError } = await supabaseClient
          .from('clinical_alerts')
          .insert(alertsToInsert);

        if (alertError) {
          console.error('Erro ao criar alertas:', alertError);
        } else {
          console.log(`Alertas criados com sucesso para ${professionals.length} profissionais`);
        }
      } else {
        console.log('Nenhum profissional vinculado encontrado para o paciente:', patientId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      alertCreated: analysisResult.hasAlert
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na análise de alertas:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});