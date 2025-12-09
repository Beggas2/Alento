-- Remover política existente e criar nova para permitir que pacientes vejam profissionais vinculados
DROP POLICY IF EXISTS "Patients can view linked professionals" ON public.profiles;

-- Criar política para permitir que pacientes vejam dados básicos dos profissionais vinculados
CREATE POLICY "Patients can view linked professionals"
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