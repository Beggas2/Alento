-- Create alert rules table
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT NOT NULL CHECK (scope IN ('global','per_patient')) DEFAULT 'per_patient',
  patient_id UUID REFERENCES public.patients(id),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  definition_json JSONB NOT NULL,
  dedup_window_minutes INTEGER DEFAULT 1440,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_patient_scope_check 
    CHECK ((scope = 'per_patient' AND patient_id IS NOT NULL) OR (scope = 'global' AND patient_id IS NULL))
);

-- Create alert instances table
CREATE TABLE IF NOT EXISTS public.alert_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.alert_rules(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payload_json JSONB,
  status TEXT NOT NULL CHECK (status IN ('new','ack','closed')) DEFAULT 'new',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alert delivery table
CREATE TABLE IF NOT EXISTS public.alert_delivery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.alert_instances(id),
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_owner ON public.alert_rules (owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rules_patient ON public.alert_rules (patient_id, is_active) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alert_instances_patient ON public.alert_instances (patient_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_rule ON public.alert_instances (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON public.alert_instances (status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_alert ON public.alert_delivery (alert_id, channel);

-- Enable RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_delivery ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_rules
CREATE POLICY "Professionals can manage their own alert rules" 
ON public.alert_rules FOR ALL 
TO authenticated USING (
  owner_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'profissional'
  )
) WITH CHECK (
  owner_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'profissional'
  )
);

-- RLS Policies for alert_instances  
CREATE POLICY "Professionals can view alerts for their patients" 
ON public.alert_instances FOR SELECT 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM alert_rules ar
    JOIN profiles p ON ar.owner_user_id = p.user_id
    WHERE ar.id = alert_instances.rule_id
    AND p.user_id = auth.uid()
    AND p.tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can update alerts for their patients" 
ON public.alert_instances FOR UPDATE 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM alert_rules ar
    JOIN profiles p ON ar.owner_user_id = p.user_id
    WHERE ar.id = alert_instances.rule_id
    AND p.user_id = auth.uid()
    AND p.tipo = 'profissional'
  )
);

CREATE POLICY "System can create alert instances" 
ON public.alert_instances FOR INSERT 
TO authenticated WITH CHECK (true);

-- RLS Policies for alert_delivery
CREATE POLICY "Professionals can view delivery status for their alerts" 
ON public.alert_delivery FOR SELECT 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM alert_instances ai
    JOIN alert_rules ar ON ai.rule_id = ar.id
    JOIN profiles p ON ar.owner_user_id = p.user_id
    WHERE ai.id = alert_delivery.alert_id
    AND p.user_id = auth.uid()
    AND p.tipo = 'profissional'
  )
);

CREATE POLICY "System can manage alert delivery" 
ON public.alert_delivery FOR ALL 
TO authenticated WITH CHECK (true);

-- Create patient metrics view for rule evaluation
CREATE OR REPLACE VIEW public.patient_metrics AS
SELECT 
  p.id as patient_id,
  p.user_id,
  -- Days without medication
  COALESCE(
    EXTRACT(DAY FROM (now() - MAX(mi.data_horario)))::integer,
    999
  ) as days_without_medication,
  
  -- Latest mood score
  (
    SELECT CAST(dr.humor AS integer)
    FROM daily_records dr
    WHERE dr.patient_id = p.id
    ORDER BY dr.created_at DESC
    LIMIT 1
  ) as mood_latest,
  
  -- Average sleep hours (last 7 days)
  (
    SELECT AVG(dr.sleep_hours)
    FROM daily_records dr
    WHERE dr.patient_id = p.id
    AND dr.created_at >= now() - interval '7 days'
    AND dr.sleep_hours IS NOT NULL
  ) as sleep_hours_avg_7d,
  
  -- Check if missing checkin for 3+ days
  CASE WHEN (
    SELECT MAX(dr.created_at)
    FROM daily_records dr
    WHERE dr.patient_id = p.id
  ) < now() - interval '3 days' THEN true ELSE false END as checkin_missing_3d,
  
  -- PHQ-9 score (latest)
  (
    SELECT SUM(qr.response_value)
    FROM questionnaire_responses qr
    JOIN questionnaires q ON qr.questionnaire_id = q.id
    WHERE qr.patient_id = p.id
    AND q.code = 'PHQ9'
    AND qr.answered_at >= now() - interval '30 days'
    GROUP BY qr.daily_record_id
    ORDER BY qr.answered_at DESC
    LIMIT 1
  ) as phq9_score,
  
  -- GAD-7 score (latest)
  (
    SELECT SUM(qr.response_value)
    FROM questionnaire_responses qr
    JOIN questionnaires q ON qr.questionnaire_id = q.id
    WHERE qr.patient_id = p.id
    AND q.code = 'GAD7'
    AND qr.answered_at >= now() - interval '30 days'
    GROUP BY qr.daily_record_id
    ORDER BY qr.answered_at DESC
    LIMIT 1
  ) as gad7_score,
  
  -- Suicide risk score (simple calculation based on mood and PHQ-9)
  CASE 
    WHEN (
      SELECT CAST(dr.humor AS integer)
      FROM daily_records dr
      WHERE dr.patient_id = p.id
      ORDER BY dr.created_at DESC
      LIMIT 1
    ) <= 2 THEN 0.8
    WHEN (
      SELECT SUM(qr.response_value)
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.patient_id = p.id
      AND q.code = 'PHQ9'
      AND qr.answered_at >= now() - interval '30 days'
      GROUP BY qr.daily_record_id
      ORDER BY qr.answered_at DESC
      LIMIT 1
    ) >= 20 THEN 0.7
    ELSE 0.1
  END as suicide_risk_score

FROM patients p
LEFT JOIN medication_intakes mi ON p.id = mi.patient_id 
  AND mi.tomado = true 
  AND mi.data_horario >= now() - interval '30 days'
GROUP BY p.id, p.user_id;

-- Function to evaluate alert rules
CREATE OR REPLACE FUNCTION public.evaluate_alert_rule(
  rule_definition JSONB,
  patient_metrics_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  all_conditions JSONB;
  any_conditions JSONB;
  condition JSONB;
  metric_name TEXT;
  operator TEXT;
  expected_value JSONB;
  actual_value JSONB;
  condition_met BOOLEAN;
  all_met BOOLEAN := true;
  any_met BOOLEAN := false;
BEGIN
  -- Get conditions
  all_conditions := rule_definition->'all';
  any_conditions := rule_definition->'any';
  
  -- Evaluate "all" conditions
  IF all_conditions IS NOT NULL AND jsonb_array_length(all_conditions) > 0 THEN
    FOR condition IN SELECT * FROM jsonb_array_elements(all_conditions)
    LOOP
      metric_name := condition->>'metric';
      operator := condition->>'op';
      expected_value := condition->'value';
      actual_value := patient_metrics_data->metric_name;
      
      -- Skip if metric not available
      IF actual_value IS NULL THEN
        all_met := false;
        EXIT;
      END IF;
      
      -- Evaluate condition based on operator
      CASE operator
        WHEN '>' THEN condition_met := (actual_value::numeric > expected_value::numeric);
        WHEN '>=' THEN condition_met := (actual_value::numeric >= expected_value::numeric);
        WHEN '<' THEN condition_met := (actual_value::numeric < expected_value::numeric);
        WHEN '<=' THEN condition_met := (actual_value::numeric <= expected_value::numeric);
        WHEN '==' THEN condition_met := (actual_value = expected_value);
        WHEN '!=' THEN condition_met := (actual_value != expected_value);
        WHEN 'is_true' THEN condition_met := (actual_value::boolean = true);
        WHEN 'is_false' THEN condition_met := (actual_value::boolean = false);
        ELSE condition_met := false;
      END CASE;
      
      IF NOT condition_met THEN
        all_met := false;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Evaluate "any" conditions
  IF any_conditions IS NOT NULL AND jsonb_array_length(any_conditions) > 0 THEN
    FOR condition IN SELECT * FROM jsonb_array_elements(any_conditions)
    LOOP
      metric_name := condition->>'metric';
      operator := condition->>'op';
      expected_value := condition->'value';
      actual_value := patient_metrics_data->metric_name;
      
      -- Skip if metric not available
      IF actual_value IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Evaluate condition based on operator
      CASE operator
        WHEN '>' THEN condition_met := (actual_value::numeric > expected_value::numeric);
        WHEN '>=' THEN condition_met := (actual_value::numeric >= expected_value::numeric);
        WHEN '<' THEN condition_met := (actual_value::numeric < expected_value::numeric);
        WHEN '<=' THEN condition_met := (actual_value::numeric <= expected_value::numeric);
        WHEN '==' THEN condition_met := (actual_value = expected_value);
        WHEN '!=' THEN condition_met := (actual_value != expected_value);
        WHEN 'is_true' THEN condition_met := (actual_value::boolean = true);
        WHEN 'is_false' THEN condition_met := (actual_value::boolean = false);
        ELSE condition_met := false;
      END CASE;
      
      IF condition_met THEN
        any_met := true;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- If no "any" conditions, consider it met
    any_met := true;
  END IF;
  
  -- Return result based on both all and any conditions
  RETURN all_met AND any_met;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check for duplicate alerts within dedup window
CREATE OR REPLACE FUNCTION public.check_alert_duplicate(
  p_rule_id UUID,
  p_patient_id UUID,
  p_dedup_minutes INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM alert_instances
    WHERE rule_id = p_rule_id
    AND patient_id = p_patient_id
    AND triggered_at >= now() - (p_dedup_minutes || ' minutes')::interval
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Update triggers
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_instances_updated_at
  BEFORE UPDATE ON public.alert_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_alert_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_entry();

CREATE TRIGGER audit_alert_instances
  AFTER INSERT OR UPDATE OR DELETE ON public.alert_instances
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_entry();