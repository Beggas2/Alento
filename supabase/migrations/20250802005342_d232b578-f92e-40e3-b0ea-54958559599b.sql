-- Adicionar política para permitir profissionais verem profiles de pacientes
CREATE POLICY "Professionals can view patient profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Permite que profissionais vejam profiles de pacientes
  EXISTS (
    SELECT 1 FROM public.profiles prof
    WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
  ) 
  AND tipo = 'paciente'
);