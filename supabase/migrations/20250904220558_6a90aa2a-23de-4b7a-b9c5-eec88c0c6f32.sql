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