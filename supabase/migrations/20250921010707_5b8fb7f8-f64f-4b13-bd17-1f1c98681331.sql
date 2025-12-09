-- Create feature flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial feature flags
INSERT INTO public.feature_flags (flag_name, is_enabled, description) VALUES
  ('internal_comments_v1', true, 'Internal team comments system'),
  ('alert_rules_v1', true, 'Advanced alert rules system'),
  ('encouragement_msgs_v1', true, 'Encouragement messages system')
ON CONFLICT (flag_name) DO UPDATE SET 
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

-- Create audit log table for LGPD compliance
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create internal comments table
CREATE TABLE IF NOT EXISTS public.internal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  author_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  tags TEXT[] DEFAULT '{}',
  visibility_scope TEXT NOT NULL CHECK (visibility_scope IN ('team','clinic')) DEFAULT 'team',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create care team table if not exists
CREATE TABLE IF NOT EXISTS public.care_team (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, professional_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_comments_patient_created ON public.internal_comments (patient_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_comments_author ON public.internal_comments (author_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_comments_tags ON public.internal_comments USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_care_team_patient ON public.care_team (patient_id);
CREATE INDEX IF NOT EXISTS idx_care_team_professional ON public.care_team (professional_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (entity, entity_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_team ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature flags (read-only for authenticated users)
CREATE POLICY "Feature flags are readable by authenticated users" 
ON public.feature_flags FOR SELECT 
TO authenticated USING (true);

-- RLS Policies for audit log (admin only)
CREATE POLICY "Audit log readable by admins only" 
ON public.audit_log FOR SELECT 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'profissional'
  )
);

-- RLS Policies for internal comments (NEVER accessible to patients)
CREATE POLICY "Internal comments denied to patients" 
ON public.internal_comments FOR ALL 
TO authenticated USING (
  NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'paciente'
  )
) WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'paciente'
  )
);

CREATE POLICY "Professionals can manage internal comments for their patients" 
ON public.internal_comments FOR ALL 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN patient_professionals pp ON p.id = pp.professional_id
    WHERE p.user_id = auth.uid() 
    AND p.tipo = 'profissional'
    AND pp.patient_id = internal_comments.patient_id
    AND pp.status = 'active'
  ) AND deleted_at IS NULL
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN patient_professionals pp ON p.id = pp.professional_id
    WHERE p.user_id = auth.uid() 
    AND p.tipo = 'profissional'
    AND pp.patient_id = internal_comments.patient_id
    AND pp.status = 'active'
  )
);

-- RLS Policies for care team
CREATE POLICY "Professionals can manage care team for their patients" 
ON public.care_team FOR ALL 
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN patient_professionals pp ON p.id = pp.professional_id
    WHERE p.user_id = auth.uid() 
    AND p.tipo = 'profissional'
    AND pp.patient_id = care_team.patient_id
    AND pp.status = 'active'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN patient_professionals pp ON p.id = pp.professional_id
    WHERE p.user_id = auth.uid() 
    AND p.tipo = 'profissional'
    AND pp.patient_id = care_team.patient_id
    AND pp.status = 'active'
  )
);

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION public.create_audit_log_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_id,
    action,
    entity,
    entity_id,
    before_data,
    after_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for internal comments
CREATE TRIGGER audit_internal_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_comments
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_entry();

-- Update trigger for internal comments
CREATE TRIGGER update_internal_comments_updated_at
  BEFORE UPDATE ON public.internal_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync care team with patient_professionals
INSERT INTO public.care_team (patient_id, professional_id)
SELECT DISTINCT pp.patient_id, pp.professional_id
FROM patient_professionals pp
WHERE pp.status = 'active'
ON CONFLICT (patient_id, professional_id) DO NOTHING;