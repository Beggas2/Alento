-- Corrigir a função para ter search_path seguro
CREATE OR REPLACE FUNCTION public.get_patient_linked_professional_ids()
RETURNS UUID[] 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN ARRAY(
    SELECT p.profissional_id 
    FROM patients p 
    WHERE p.user_id = auth.uid() AND p.profissional_id IS NOT NULL
  );
END;
$$;