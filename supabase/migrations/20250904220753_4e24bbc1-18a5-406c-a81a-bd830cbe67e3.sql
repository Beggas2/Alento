-- Atualizar função process_link_request para usar a nova estrutura
CREATE OR REPLACE FUNCTION public.process_link_request(request_id uuid, action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  patient_record RECORD;
BEGIN
  -- Verificar se a solicitação existe e o usuário pode atualizá-la
  SELECT * INTO request_record 
  FROM link_requests 
  WHERE id = request_id 
    AND target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar status da solicitação
  UPDATE link_requests 
  SET status = action, updated_at = now()
  WHERE id = request_id;
  
  -- Se aceita, criar vinculação na nova tabela
  IF action = 'accepted' THEN
    IF request_record.requester_type = 'paciente' AND request_record.target_type = 'profissional' THEN
      -- Paciente solicitou para profissional
      SELECT id INTO patient_record 
      FROM patients 
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.requester_id);
      
      IF FOUND THEN
        INSERT INTO patient_professionals (patient_id, professional_id)
        VALUES (patient_record.id, request_record.target_id)
        ON CONFLICT (patient_id, professional_id) DO NOTHING;
      END IF;
    ELSIF request_record.requester_type = 'profissional' AND request_record.target_type = 'paciente' THEN
      -- Profissional solicitou para paciente
      SELECT id INTO patient_record 
      FROM patients 
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.target_id);
      
      IF FOUND THEN
        INSERT INTO patient_professionals (patient_id, professional_id)
        VALUES (patient_record.id, request_record.requester_id)
        ON CONFLICT (patient_id, professional_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$function$