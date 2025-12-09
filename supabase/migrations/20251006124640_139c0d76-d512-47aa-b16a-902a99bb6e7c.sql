-- Tabela para registro de consentimento de voz
CREATE TABLE IF NOT EXISTS public.voice_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para logs de transcrição
CREATE TABLE IF NOT EXISTS public.voice_transcription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  duration_sec NUMERIC NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'whisper',
  language_detected TEXT,
  transcription_time_ms INTEGER,
  confidence NUMERIC,
  status TEXT NOT NULL, -- 'success', 'error', 'retry'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para controle de limites diários
CREATE TABLE IF NOT EXISTS public.voice_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transcriptions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.voice_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_transcription_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies para voice_consent
CREATE POLICY "Users can manage their own voice consent"
  ON public.voice_consent
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies para voice_transcription_logs
CREATE POLICY "Patients can view their own transcription logs"
  ON public.voice_transcription_logs
  FOR SELECT
  USING (patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  ));

CREATE POLICY "Professionals can view logs for their patients"
  ON public.voice_transcription_logs
  FOR SELECT
  USING (patient_id IN (
    SELECT pp.patient_id
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() 
      AND prof.tipo = 'profissional'
      AND pp.status = 'active'
  ));

CREATE POLICY "System can insert transcription logs"
  ON public.voice_transcription_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies para voice_usage_daily
CREATE POLICY "Patients can view their own usage"
  ON public.voice_usage_daily
  FOR SELECT
  USING (patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can manage voice usage"
  ON public.voice_usage_daily
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_voice_consent_user_id ON public.voice_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_patient_id ON public.voice_transcription_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_voice_usage_patient_date ON public.voice_usage_daily(patient_id, usage_date);