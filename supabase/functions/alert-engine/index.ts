import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, ruleId, patientId, definition, testMode } = await req.json()

    switch (action) {
      case 'evaluate_rules':
        return await evaluateRules(supabaseClient)
      
      case 'test_rule':
        return await testRule(supabaseClient, definition, patientId)
      
      case 'acknowledge_alert':
        return await acknowledgeAlert(supabaseClient, req)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function evaluateRules(supabaseClient: any) {
  console.log('Starting rule evaluation...')
  
  // Get all active alert rules
  const { data: rules, error: rulesError } = await supabaseClient
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)

  if (rulesError) throw rulesError

  console.log(`Found ${rules?.length || 0} active rules`)

  let alertsCreated = 0

  for (const rule of rules || []) {
    // Get patients to evaluate
    let patientIds = []
    
    if (rule.scope === 'per_patient') {
      patientIds = [rule.patient_id]
    } else {
      // Global rule - get all patients for this professional
      const { data: patientData } = await supabaseClient
        .from('patient_professionals')
        .select('patient_id')
        .eq('professional_id', rule.owner_user_id)
        .eq('status', 'active')
      
      patientIds = patientData?.map(p => p.patient_id) || []
    }

    for (const patientId of patientIds) {
      // Check for duplicates within dedup window
      const { data: isDuplicate } = await supabaseClient
        .rpc('check_alert_duplicate', {
          p_rule_id: rule.id,
          p_patient_id: patientId,
          p_dedup_minutes: rule.dedup_window_minutes
        })

      if (isDuplicate) {
        console.log(`Skipping duplicate alert for rule ${rule.id}, patient ${patientId}`)
        continue
      }

      // Get patient metrics
      const { data: metrics, error: metricsError } = await supabaseClient
        .from('patient_metrics')
        .select('*')
        .eq('patient_id', patientId)
        .single()

      if (metricsError || !metrics) {
        console.log(`No metrics found for patient ${patientId}`)
        continue
      }

      // Convert metrics to JSONB for evaluation
      const metricsJson = {
        days_without_medication: metrics.days_without_medication,
        mood_latest: metrics.mood_latest,
        phq9_score: metrics.phq9_score,
        gad7_score: metrics.gad7_score,
        sleep_hours_avg_7d: metrics.sleep_hours_avg_7d,
        suicide_risk_score: metrics.suicide_risk_score,
        checkin_missing_3d: metrics.checkin_missing_3d
      }

      // Evaluate rule
      const { data: ruleMatches } = await supabaseClient
        .rpc('evaluate_alert_rule', {
          rule_definition: rule.definition_json,
          patient_metrics_data: metricsJson
        })

      if (ruleMatches) {
        // Create alert instance
        const { error: alertError } = await supabaseClient
          .from('alert_instances')
          .insert({
            rule_id: rule.id,
            patient_id: patientId,
            payload_json: {
              metrics: metricsJson,
              rule_definition: rule.definition_json,
              rule_name: rule.name
            }
          })

        if (alertError) {
          console.error('Error creating alert:', alertError)
        } else {
          alertsCreated++
          console.log(`Created alert for rule ${rule.name}, patient ${patientId}`)
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      alertsCreated,
      rulesEvaluated: rules?.length || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function testRule(supabaseClient: any, definition: any, patientId: string) {
  console.log('Testing rule for patient:', patientId)
  
  // Get patient metrics
  const { data: metrics, error: metricsError } = await supabaseClient
    .from('patient_metrics')
    .select('*')
    .eq('patient_id', patientId)
    .single()

  if (metricsError || !metrics) {
    return new Response(
      JSON.stringify({ error: 'Patient metrics not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Convert metrics to JSONB for evaluation
  const metricsJson = {
    days_without_medication: metrics.days_without_medication,
    mood_latest: metrics.mood_latest,
    phq9_score: metrics.phq9_score,
    gad7_score: metrics.gad7_score,
    sleep_hours_avg_7d: metrics.sleep_hours_avg_7d,
    suicide_risk_score: metrics.suicide_risk_score,
    checkin_missing_3d: metrics.checkin_missing_3d
  }

  // Evaluate rule
  const { data: ruleMatches } = await supabaseClient
    .rpc('evaluate_alert_rule', {
      rule_definition: definition,
      patient_metrics_data: metricsJson
    })

  return new Response(
    JSON.stringify({ 
      matches: ruleMatches,
      metrics: metricsJson,
      definition
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function acknowledgeAlert(supabaseClient: any, req: Request) {
  // Get user from auth header
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Authorization required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { alertId, status } = await req.json()

  const { error } = await supabaseClient
    .from('alert_instances')
    .update({
      status,
      acknowledged_at: new Date().toISOString()
    })
    .eq('id', alertId)

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}