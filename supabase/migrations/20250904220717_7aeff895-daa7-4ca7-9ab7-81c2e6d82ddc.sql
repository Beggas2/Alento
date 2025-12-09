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