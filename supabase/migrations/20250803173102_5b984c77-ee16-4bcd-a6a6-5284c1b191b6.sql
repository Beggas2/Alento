-- Corrigir a política de UPDATE para permitir que profissionais atualizem
-- pacientes que NÃO têm profissional ainda (profissional_id IS NULL)
DROP POLICY IF EXISTS "Professionals can update patient links" ON public.patients;

CREATE POLICY "Professionals can update patient links" 
ON public.patients 
FOR UPDATE 
USING (
  -- Permite atualizar se:
  -- 1. O paciente não tem profissional ainda (profissional_id IS NULL) OU
  -- 2. O profissional atual é quem está fazendo a atualização
  profissional_id IS NULL OR
  profissional_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
) 
WITH CHECK (
  -- Garante que o profissional_id no UPDATE é do usuário logado
  profissional_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
);