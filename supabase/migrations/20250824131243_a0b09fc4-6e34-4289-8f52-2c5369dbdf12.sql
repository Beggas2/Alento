-- Corrigir função find_patient_by_code - fazer cast do enum para text
CREATE OR REPLACE FUNCTION find_patient_by_code(patient_code text)
RETURNS TABLE(id uuid, user_id uuid, nome text, email text, tipo text, codigo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se quem chama é um profissional
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.tipo = 'profissional'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas profissionais podem buscar pacientes';
  END IF;

  -- Buscar paciente por código, fazendo cast do enum para text
  RETURN QUERY
  SELECT p.id, p.user_id, p.nome, p.email, p.tipo::text, p.codigo
  FROM profiles p
  WHERE p.codigo = UPPER(patient_code)
  AND p.tipo = 'paciente';
END;
$$;