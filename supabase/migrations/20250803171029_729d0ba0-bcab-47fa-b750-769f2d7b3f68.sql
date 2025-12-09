-- Adicionar política para permitir profissionais atualizarem vínculos de pacientes
CREATE POLICY "Professionals can update patient links" 
ON public.patients 
FOR UPDATE 
USING (
  -- Permite que profissionais atualizem registros onde eles são o profissional atual ou vão ser
  profissional_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
) 
WITH CHECK (
  -- Garante que o profissional_id no UPDATE é o do usuário logado
  profissional_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  )
);