-- Remover a política problemática que causa recursão infinita
DROP POLICY IF EXISTS "Professionals can view patient profiles" ON public.profiles;

-- Criar função security definer para verificar tipo de usuário sem recursão
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT tipo FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Criar nova política que permite profissionais verem pacientes usando a função
CREATE POLICY "Professionals can view patient profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Permite que profissionais vejam profiles de pacientes
  (public.get_user_type() = 'profissional' AND tipo = 'paciente')
  OR
  -- Permite que usuários vejam seu próprio profile (política original)
  user_id = auth.uid()
);