-- Remover policies antigas que usavam a estrutura de um único profissional
DROP POLICY IF EXISTS "Professionals can view their patients" ON public.patients;
DROP POLICY IF EXISTS "Professionals can update their patients" ON public.patients;
DROP POLICY IF EXISTS "Professionals can view their patients records" ON public.daily_records;
DROP POLICY IF EXISTS "Professionals can update their patients records" ON public.daily_records;
DROP POLICY IF EXISTS "Professionals can view all medications of their patients" ON public.medications;
DROP POLICY IF EXISTS "Professionals can view their patients medication intakes" ON public.medication_intakes;
DROP POLICY IF EXISTS "Professionals can insert medications for their patients" ON public.medications;

-- Criar novas policies usando a estrutura patient_professionals
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