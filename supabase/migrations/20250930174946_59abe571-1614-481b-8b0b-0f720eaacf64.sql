-- Create bot_knowledge table for curated content
CREATE TABLE public.bot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  content_md TEXT NOT NULL,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}'
);

-- Create bot_interaction table for logging conversations
CREATE TABLE public.bot_interaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  reply TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0,
  matched_content_id UUID REFERENCES public.bot_knowledge(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Create crisis_resources table for regional emergency contacts
CREATE TABLE public.crisis_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  region TEXT,
  hotline_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  description TEXT,
  available_hours TEXT DEFAULT '24/7',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bot_knowledge
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;

-- Professionals can manage bot knowledge
CREATE POLICY "Professionals can manage bot knowledge"
ON public.bot_knowledge
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.tipo = 'profissional'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.tipo = 'profissional'
  )
);

-- Patients can view active bot knowledge
CREATE POLICY "Patients can view active bot knowledge"
ON public.bot_knowledge
FOR SELECT
TO authenticated
USING (is_active = true);

-- Enable RLS on bot_interaction
ALTER TABLE public.bot_interaction ENABLE ROW LEVEL SECURITY;

-- Patients can view their own interactions
CREATE POLICY "Patients can view their own interactions"
ON public.bot_interaction
FOR SELECT
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

-- Patients can insert their own interactions
CREATE POLICY "Patients can insert their own interactions"
ON public.bot_interaction
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

-- Professionals can view interactions for their patients
CREATE POLICY "Professionals can view patient interactions"
ON public.bot_interaction
FOR SELECT
TO authenticated
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

-- Patients can delete their own interactions
CREATE POLICY "Patients can delete their own interactions"
ON public.bot_interaction
FOR DELETE
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

-- Enable RLS on crisis_resources
ALTER TABLE public.crisis_resources ENABLE ROW LEVEL SECURITY;

-- Everyone can view active crisis resources
CREATE POLICY "Everyone can view active crisis resources"
ON public.crisis_resources
FOR SELECT
TO authenticated
USING (is_active = true);

-- Professionals can manage crisis resources
CREATE POLICY "Professionals can manage crisis resources"
ON public.crisis_resources
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.tipo = 'profissional'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.tipo = 'profissional'
  )
);

-- Insert default crisis resources for Brazil
INSERT INTO public.crisis_resources (country_code, region, hotline_name, phone_number, description) VALUES
('BR', 'Nacional', 'CVV - Centro de Valorização da Vida', '188', 'Apoio emocional e prevenção do suicídio'),
('BR', 'Nacional', 'SAMU', '192', 'Emergências médicas'),
('BR', 'Nacional', 'Bombeiros', '193', 'Emergências e resgates'),
('BR', 'Nacional', 'Polícia Militar', '190', 'Emergências policiais');

-- Create indexes for better performance
CREATE INDEX idx_bot_knowledge_category ON public.bot_knowledge(category);
CREATE INDEX idx_bot_knowledge_locale ON public.bot_knowledge(locale);
CREATE INDEX idx_bot_knowledge_is_active ON public.bot_knowledge(is_active);
CREATE INDEX idx_bot_interaction_patient_id ON public.bot_interaction(patient_id);
CREATE INDEX idx_bot_interaction_created_at ON public.bot_interaction(created_at);
CREATE INDEX idx_bot_interaction_risk_score ON public.bot_interaction(risk_score);
CREATE INDEX idx_crisis_resources_country_code ON public.crisis_resources(country_code);

-- Add trigger for updated_at
CREATE TRIGGER update_bot_knowledge_updated_at
  BEFORE UPDATE ON public.bot_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crisis_resources_updated_at
  BEFORE UPDATE ON public.crisis_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();