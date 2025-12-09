-- Adicionar política para permitir profissionais inserirem vínculos com pacientes
CREATE POLICY "Professionals can link patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (
  -- Permite que profissionais insiram registros vinculando pacientes
  profissional_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
);