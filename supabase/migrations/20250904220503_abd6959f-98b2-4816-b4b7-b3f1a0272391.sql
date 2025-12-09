-- Criar tabela de relacionamento many-to-many entre pacientes e profissionais
CREATE TABLE public.patient_professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(patient_id, professional_id)
);

-- Migrar dados existentes da tabela patients
INSERT INTO public.patient_professionals (patient_id, professional_id)
SELECT id, profissional_id 
FROM public.patients 
WHERE profissional_id IS NOT NULL;

-- Habilitar RLS na nova tabela
ALTER TABLE public.patient_professionals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para patient_professionals
CREATE POLICY "Patients can view their professionals"
ON public.patient_professionals
FOR SELECT
USING (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Professionals can view their patients"
ON public.patient_professionals
FOR SELECT
USING (
  professional_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can insert patient relationships"
ON public.patient_professionals
FOR INSERT
WITH CHECK (
  professional_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can update patient relationships"
ON public.patient_professionals
FOR UPDATE
USING (
  professional_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND tipo = 'profissional'
  )
);

-- Atualizar função para buscar IDs de profissionais vinculados
CREATE OR REPLACE FUNCTION public.get_patient_linked_professional_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN ARRAY(
    SELECT pp.professional_id 
    FROM patient_professionals pp
    JOIN patients p ON pp.patient_id = p.id 
    WHERE p.user_id = auth.uid() AND pp.status = 'active'
  );
END;
$function$

-- Atualizar função process_link_request para usar a nova estrutura
CREATE OR REPLACE FUNCTION public.process_link_request(request_id uuid, action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  patient_record RECORD;
BEGIN
  -- Verificar se a solicitação existe e o usuário pode atualizá-la
  SELECT * INTO request_record 
  FROM link_requests 
  WHERE id = request_id 
    AND target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar status da solicitação
  UPDATE link_requests 
  SET status = action, updated_at = now()
  WHERE id = request_id;
  
  -- Se aceita, criar vinculação na nova tabela
  IF action = 'accepted' THEN
    IF request_record.requester_type = 'paciente' AND request_record.target_type = 'profissional' THEN
      -- Paciente solicitou para profissional
      SELECT id INTO patient_record 
      FROM patients 
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.requester_id);
      
      IF FOUND THEN
        INSERT INTO patient_professionals (patient_id, professional_id)
        VALUES (patient_record.id, request_record.target_id)
        ON CONFLICT (patient_id, professional_id) DO NOTHING;
      END IF;
    ELSIF request_record.requester_type = 'profissional' AND request_record.target_type = 'paciente' THEN
      -- Profissional solicitou para paciente
      SELECT id INTO patient_record 
      FROM patients 
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.target_id);
      
      IF FOUND THEN
        INSERT INTO patient_professionals (patient_id, professional_id)
        VALUES (patient_record.id, request_record.requester_id)
        ON CONFLICT (patient_id, professional_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$function$

-- Atualizar policies existentes para usar a nova estrutura
DROP POLICY IF EXISTS "Professionals can view their patients" ON public.patients;
DROP POLICY IF EXISTS "Professionals can update their patients" ON public.patients;
DROP POLICY IF EXISTS "Professionals can view their patients records" ON public.daily_records;
DROP POLICY IF EXISTS "Professionals can update their patients records" ON public.daily_records;
DROP POLICY IF EXISTS "Professionals can view all medications of their patients" ON public.medications;
DROP POLICY IF EXISTS "Professionals can view their patients medication intakes" ON public.medication_intakes;

-- Recriar policies usando a nova estrutura patient_professionals
CREATE POLICY "Professionals can view their patients"
ON public.patients
FOR SELECT
USING (
  id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

CREATE POLICY "Professionals can update their patients"
ON public.patients
FOR UPDATE
USING (
  id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

CREATE POLICY "Professionals can view their patients records"
ON public.daily_records
FOR SELECT
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

CREATE POLICY "Professionals can update their patients records"
ON public.daily_records
FOR UPDATE
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

CREATE POLICY "Professionals can view all medications of their patients"
ON public.medications
FOR SELECT
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

CREATE POLICY "Professionals can view their patients medication intakes"
ON public.medication_intakes
FOR SELECT
USING (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

-- Atualizar policy para inserção de medicamentos
DROP POLICY IF EXISTS "Professionals can insert medications for their patients" ON public.medications;
CREATE POLICY "Professionals can insert medications for their patients"
ON public.medications
FOR INSERT
WITH CHECK (
  prescrito_por IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND tipo = 'profissional'
  ) AND 
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

-- Criar trigger para updated_at
CREATE TRIGGER update_patient_professionals_updated_at
BEFORE UPDATE ON public.patient_professionals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();