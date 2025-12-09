-- Função para permitir que profissionais busquem pacientes
-- Execute este SQL no Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION find_patient_by_email(patient_email TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  nome TEXT,
  email TEXT,
  tipo TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar se quem chama é um profissional
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'profissional'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas profissionais podem buscar pacientes';
  END IF;

  -- Buscar paciente por email
  RETURN QUERY
  SELECT p.id, p.user_id, p.nome, p.email, p.tipo
  FROM profiles p
  WHERE p.email = patient_email 
  AND p.tipo = 'paciente';
END;
$$;