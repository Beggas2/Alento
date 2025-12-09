-- Permitir que profissionais vejam pacientes mesmo sem vínculo ainda
-- para poderem verificar registros existentes antes de criar vínculos
CREATE POLICY "Professionals can view all patient records for linking" 
ON public.patients 
FOR SELECT 
USING (
  -- Permite que profissionais vejam todos os registros de pacientes
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
);