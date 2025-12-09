-- Adicionar política para profissionais verem medicamentos de todos os seus pacientes
CREATE POLICY "Professionals can view all medications of their patients" 
ON public.medications 
FOR SELECT 
USING (
  patient_id IN (
    SELECT p.id 
    FROM patients p 
    JOIN profiles prof ON p.profissional_id = prof.id 
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional'
  )
);