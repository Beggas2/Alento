-- Criar política para permitir que pacientes vejam dados básicos dos profissionais vinculados
CREATE OR REPLACE POLICY "Patients can view linked professionals"
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  tipo = 'profissional' AND 
  id IN (
    SELECT p.profissional_id 
    FROM patients p 
    WHERE p.user_id = auth.uid() AND p.profissional_id IS NOT NULL
  )
);