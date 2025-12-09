-- Adicionar política para permitir que profissionais criem progresso de questionários para seus pacientes
CREATE POLICY "Professionals can insert questionnaire progress for their patients" 
ON public.patient_questionnaire_progress FOR INSERT 
WITH CHECK (
  patient_id IN (
    SELECT pp.patient_id FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

-- Adicionar política para permitir que profissionais atualizem progresso de questionários de seus pacientes
CREATE POLICY "Professionals can update questionnaire progress for their patients" 
ON public.patient_questionnaire_progress FOR UPDATE 
USING (
  patient_id IN (
    SELECT pp.patient_id FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);