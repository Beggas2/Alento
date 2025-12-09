-- Primeiro, vamos remover as políticas problemáticas
DROP POLICY IF EXISTS "Professionals can view all patient records for linking" ON public.patients;
DROP POLICY IF EXISTS "Professionals can update patient links" ON public.patients;
DROP POLICY IF EXISTS "Professionals can view their patients" ON public.patients;
DROP POLICY IF EXISTS "Professionals can update their patients" ON public.patients;

-- Criar função de segurança para obter o tipo de usuário
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS TEXT AS $$
  SELECT tipo::text FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Criar função para obter IDs dos pacientes vinculados ao profissional
CREATE OR REPLACE FUNCTION public.get_professional_patient_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY_AGG(pp.patient_id) 
  FROM patient_professionals pp
  JOIN profiles prof ON pp.professional_id = prof.id
  WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional' 
    AND pp.status = 'active';
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Recriar políticas usando as funções de segurança
CREATE POLICY "Professionals can view patient profiles for linking"
ON public.patients
FOR SELECT
USING (get_user_type() = 'profissional');

CREATE POLICY "Professionals can view their linked patients"
ON public.patients
FOR SELECT
USING (id = ANY(get_professional_patient_ids()));

CREATE POLICY "Professionals can update their linked patients"
ON public.patients
FOR UPDATE
USING (id = ANY(get_professional_patient_ids()));

CREATE POLICY "Professionals can link to patients"
ON public.patients
FOR UPDATE
USING (
  get_user_type() = 'profissional' AND 
  (profissional_id IS NULL OR id = ANY(get_professional_patient_ids()))
)
WITH CHECK (
  get_user_type() = 'profissional'
);