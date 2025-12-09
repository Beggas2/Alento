-- Corrigir a função get_professional_patient_ids para retornar array vazio quando não houver resultados
CREATE OR REPLACE FUNCTION public.get_professional_patient_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(ARRAY_AGG(pp.patient_id), '{}')
  FROM patient_professionals pp
  JOIN profiles prof ON pp.professional_id = prof.id
  WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional' 
    AND pp.status = 'active';
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Corrigir a função get_patient_linked_professional_ids também
CREATE OR REPLACE FUNCTION public.get_patient_linked_professional_ids()
RETURNS uuid[] AS $$
BEGIN
  RETURN COALESCE(ARRAY(
    SELECT pp.professional_id 
    FROM patient_professionals pp
    JOIN patients p ON pp.patient_id = p.id 
    WHERE p.user_id = auth.uid() AND pp.status = 'active'
  ), '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;