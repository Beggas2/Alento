import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PatientMetrics {
  patient_id: string;
  days_without_medication: number;
  mood_latest: number;
  sleep_hours_avg_7d: number;
  checkin_missing_3d: boolean;
  phq9_score: number;
  gad7_score: number;
  suicide_risk_score: number;
}

interface AlertRule {
  id: string;
  owner_user_id: string;
  scope: string;
  patient_id?: string;
  name: string;
  is_active: boolean;
  definition_json: any;
  dedup_window_minutes: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'test_rule') {
      // Test a rule against current patient data
      const { rule_definition, patient_id } = await req.json();
      
      // Get patient metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('patient_metrics')
        .select('*')
        .eq('patient_id', patient_id)
        .single();

      if (metricsError) {
        console.error('Error fetching patient metrics:', metricsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch patient metrics' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Evaluate the rule
      const { data: ruleResult, error: evalError } = await supabase
        .rpc('evaluate_alert_rule', {
          rule_definition,
          patient_metrics_data: metrics
        });

      if (evalError) {
        console.error('Error evaluating rule:', evalError);
        return new Response(
          JSON.stringify({ error: 'Failed to evaluate rule' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ 
          would_trigger: ruleResult,
          patient_metrics: metrics,
          rule_definition 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'evaluate_all') {
      // Evaluate all active rules
      console.log('Starting alert evaluation for all active rules');

      // Get all active alert rules
      const { data: activeRules, error: rulesError } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('is_active', true);

      if (rulesError) {
        console.error('Error fetching active rules:', rulesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch active rules' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Found ${activeRules?.length || 0} active rules`);

      // Get all patient metrics
      const { data: allMetrics, error: metricsError } = await supabase
        .from('patient_metrics')
        .select('*');

      if (metricsError) {
        console.error('Error fetching patient metrics:', metricsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch patient metrics' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Processing metrics for ${allMetrics?.length || 0} patients`);

      let alertsCreated = 0;
      let alertsSkipped = 0;

      // Process each rule
      for (const rule of activeRules || []) {
        // Determine which patients to evaluate
        const patientsToEvaluate = rule.scope === 'per_patient' 
          ? allMetrics?.filter(m => m.patient_id === rule.patient_id) || []
          : allMetrics || [];

        console.log(`Evaluating rule "${rule.name}" for ${patientsToEvaluate.length} patients`);

        for (const patientMetrics of patientsToEvaluate) {
          try {
            // Check for duplicates first
            const { data: isDuplicate } = await supabase
              .rpc('check_alert_duplicate', {
                p_rule_id: rule.id,
                p_patient_id: patientMetrics.patient_id,
                p_dedup_minutes: rule.dedup_window_minutes
              });

            if (isDuplicate) {
              alertsSkipped++;
              console.log(`Skipping duplicate alert for rule ${rule.id}, patient ${patientMetrics.patient_id}`);
              continue;
            }

            // Evaluate the rule
            const { data: shouldTrigger, error: evalError } = await supabase
              .rpc('evaluate_alert_rule', {
                rule_definition: rule.definition_json,
                patient_metrics_data: patientMetrics
              });

            if (evalError) {
              console.error(`Error evaluating rule ${rule.id}:`, evalError);
              continue;
            }

            if (shouldTrigger) {
              // Create alert instance
              const { error: insertError } = await supabase
                .from('alert_instances')
                .insert({
                  rule_id: rule.id,
                  patient_id: patientMetrics.patient_id,
                  payload_json: {
                    rule_name: rule.name,
                    patient_metrics: patientMetrics,
                    triggered_conditions: rule.definition_json,
                    timestamp: new Date().toISOString()
                  }
                });

              if (insertError) {
                console.error(`Error creating alert instance:`, insertError);
                continue;
              }

              alertsCreated++;
              console.log(`Created alert for rule "${rule.name}", patient ${patientMetrics.patient_id}`);

              // Schedule in-app notification delivery
              const { error: deliveryError } = await supabase
                .from('alert_delivery')
                .insert({
                  alert_id: (await supabase
                    .from('alert_instances')
                    .select('id')
                    .eq('rule_id', rule.id)
                    .eq('patient_id', patientMetrics.patient_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()).data?.id,
                  channel: 'in_app',
                  status: 'sent'
                });

              if (deliveryError) {
                console.error(`Error creating delivery record:`, deliveryError);
              }
            }
          } catch (error) {
            console.error(`Error processing rule ${rule.id} for patient ${patientMetrics.patient_id}:`, error);
          }
        }
      }

      console.log(`Alert evaluation completed: ${alertsCreated} alerts created, ${alertsSkipped} skipped`);

      return new Response(
        JSON.stringify({
          success: true,
          alerts_created: alertsCreated,
          alerts_skipped: alertsSkipped,
          rules_processed: activeRules?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Alert evaluation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});