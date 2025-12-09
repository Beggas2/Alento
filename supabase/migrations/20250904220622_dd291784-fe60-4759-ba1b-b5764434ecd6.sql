-- Atualizar função para buscar IDs de profissionais vinculados
CREATE OR REPLACE FUNCTION public.get_patient_linked_professional_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN ARRAY(
    SELECT pp.professional_id 
    FROM patient_professionals pp
    JOIN patients p ON pp.patient_id = p.id 
    WHERE p.user_id = auth.uid() AND pp.status = 'active'
  );
END;
$function$