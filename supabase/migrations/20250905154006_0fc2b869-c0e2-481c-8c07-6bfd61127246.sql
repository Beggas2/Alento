-- Atualizar policies para medicamentos usando a nova estrutura
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