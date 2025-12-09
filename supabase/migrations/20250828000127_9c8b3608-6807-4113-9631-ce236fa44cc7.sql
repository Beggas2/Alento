-- Primeiro, vamos remover a política problemática
DROP POLICY IF EXISTS "Patients can view linked professionals" ON public.profiles;

-- Criar uma função security definer para evitar recursão infinita
CREATE OR REPLACE FUNCTION public.get_patient_linked_professional_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT p.profissional_id 
    FROM patients p 
    WHERE p.user_id = auth.uid() AND p.profissional_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Agora criar a política usando a função
CREATE POLICY "Patients can view linked professionals"
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  tipo = 'profissional' AND 
  id = ANY(public.get_patient_linked_professional_ids())
);