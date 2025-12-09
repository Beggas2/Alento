-- Create AI summaries table
CREATE TABLE public.ai_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sections_json JSONB NOT NULL DEFAULT '{}',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  summary_type TEXT NOT NULL DEFAULT 'weekly', -- weekly, monthly, on_demand
  status TEXT NOT NULL DEFAULT 'completed', -- pending, completed, failed
  encrypted_content TEXT, -- encrypted summary content for LGPD compliance
  redacted_content TEXT -- redacted version without PII
);

-- Create AI usage ledger table
CREATE TABLE public.ai_usage_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  feature TEXT NOT NULL, -- 'summary_generation', 'alert_analysis', etc
  tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  patient_id UUID, -- optional reference to specific patient
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_summaries
CREATE POLICY "Professionals can view summaries for their patients"
ON public.ai_summaries FOR SELECT
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
    AND pp.status = 'active'
  )
);

CREATE POLICY "Patients can view their own summaries"
ON public.ai_summaries FOR SELECT
USING (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert summaries"
ON public.ai_summaries FOR INSERT
WITH CHECK (true);

CREATE POLICY "Professionals can update summaries for their patients"
ON public.ai_summaries FOR UPDATE
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
    AND pp.status = 'active'
  )
);

-- RLS Policies for ai_usage_ledger
CREATE POLICY "Users can view their own usage"
ON public.ai_usage_ledger FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert usage records"
ON public.ai_usage_ledger FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_ai_summaries_patient_id ON public.ai_summaries(patient_id);
CREATE INDEX idx_ai_summaries_period ON public.ai_summaries(period_start, period_end);
CREATE INDEX idx_ai_summaries_created_at ON public.ai_summaries(created_at);
CREATE INDEX idx_ai_usage_ledger_user_id ON public.ai_usage_ledger(user_id);
CREATE INDEX idx_ai_usage_ledger_created_at ON public.ai_usage_ledger(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_summaries_updated_at
BEFORE UPDATE ON public.ai_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate summary on demand
CREATE OR REPLACE FUNCTION public.request_patient_summary(
  p_patient_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_summary_type TEXT DEFAULT 'on_demand'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  summary_id UUID;
  requester_profile profiles;
BEGIN
  -- Check if requester is a professional with access to this patient
  SELECT * INTO requester_profile
  FROM profiles
  WHERE user_id = auth.uid() AND tipo = 'profissional';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado: apenas profissionais podem solicitar resumos';
  END IF;
  
  -- Verify professional has access to patient
  IF NOT EXISTS (
    SELECT 1 FROM patient_professionals pp
    WHERE pp.patient_id = p_patient_id
    AND pp.professional_id = requester_profile.id
    AND pp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: profissional não tem acesso a este paciente';
  END IF;
  
  -- Check if summary already exists for this period
  SELECT id INTO summary_id
  FROM ai_summaries
  WHERE patient_id = p_patient_id
  AND period_start = p_period_start
  AND period_end = p_period_end
  AND summary_type = p_summary_type;
  
  -- If summary exists, return existing ID
  IF FOUND THEN
    RETURN summary_id;
  END IF;
  
  -- Create new summary request
  INSERT INTO ai_summaries (
    patient_id,
    period_start,
    period_end,
    summary_type,
    status,
    generated_by
  ) VALUES (
    p_patient_id,
    p_period_start,
    p_period_end,
    p_summary_type,
    'pending',
    auth.uid()
  ) RETURNING id INTO summary_id;
  
  RETURN summary_id;
END;
$$;