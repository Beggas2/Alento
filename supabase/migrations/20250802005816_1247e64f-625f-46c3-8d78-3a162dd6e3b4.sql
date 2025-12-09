-- Remover política duplicada "Users can view own profile" pois já temos na nova política
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Corrigir a função para ter search_path seguro
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tipo FROM public.profiles WHERE user_id = auth.uid();
$$;