-- Adicionar coluna codigo na tabela profiles para códigos únicos de usuário
ALTER TABLE public.profiles ADD COLUMN codigo TEXT;

-- Criar índice único para o código
CREATE UNIQUE INDEX profiles_codigo_unique ON public.profiles(codigo) WHERE codigo IS NOT NULL;

-- Função para gerar códigos únicos baseados no tipo de usuário
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prefix TEXT;
    new_code TEXT;
    counter INTEGER := 1;
    max_attempts INTEGER := 1000;
BEGIN
    -- Determinar o prefixo baseado no tipo de usuário
    SELECT 
        CASE 
            WHEN tipo = 'profissional' AND (especialidade ILIKE '%médic%' OR especialidade ILIKE '%psiquiat%' OR crp_crm ILIKE 'crm%') THEN 'PM'
            WHEN tipo = 'profissional' THEN 'PS'
            WHEN tipo = 'paciente' THEN 'PC'
            ELSE 'US'
        END INTO prefix
    FROM profiles 
    WHERE user_id = auth.uid();
    
    -- Gerar código único
    WHILE counter <= max_attempts LOOP
        new_code := prefix || LPAD(counter::TEXT, 6, '0');
        
        -- Verificar se o código já existe
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE codigo = new_code) THEN
            RETURN new_code;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    -- Se não conseguir gerar um código único, usar timestamp
    RETURN prefix || LPAD(EXTRACT(EPOCH FROM NOW())::INTEGER::TEXT, 6, '0');
END;
$$;

-- Trigger para gerar código automaticamente quando um perfil é criado
CREATE OR REPLACE FUNCTION public.assign_user_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se o código não foi fornecido, gerar automaticamente
    IF NEW.codigo IS NULL THEN
        NEW.codigo := public.generate_user_code();
    END IF;
    RETURN NEW;
END;
$$;

-- Criar trigger para novos usuários
DROP TRIGGER IF EXISTS assign_user_code_trigger ON public.profiles;
CREATE TRIGGER assign_user_code_trigger
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_user_code();

-- Função para gerar códigos para usuários existentes
CREATE OR REPLACE FUNCTION public.generate_codes_for_existing_users()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_record RECORD;
    prefix TEXT;
    counter INTEGER;
    new_code TEXT;
BEGIN
    FOR user_record IN 
        SELECT id, tipo, especialidade, crp_crm, created_at 
        FROM profiles 
        WHERE codigo IS NULL 
        ORDER BY tipo, created_at
    LOOP
        -- Determinar o prefixo
        CASE 
            WHEN user_record.tipo = 'profissional' AND (
                user_record.especialidade ILIKE '%médic%' OR 
                user_record.especialidade ILIKE '%psiquiat%' OR 
                user_record.crp_crm ILIKE 'crm%'
            ) THEN prefix := 'PM';
            WHEN user_record.tipo = 'profissional' THEN prefix := 'PS';
            WHEN user_record.tipo = 'paciente' THEN prefix := 'PC';
            ELSE prefix := 'US';
        END CASE;
        
        -- Encontrar próximo número disponível
        counter := 1;
        LOOP
            new_code := prefix || LPAD(counter::TEXT, 6, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE codigo = new_code);
            counter := counter + 1;
        END LOOP;
        
        -- Atualizar o usuário
        UPDATE profiles SET codigo = new_code WHERE id = user_record.id;
    END LOOP;
END;
$$;

-- Executar a função para gerar códigos para usuários existentes
SELECT public.generate_codes_for_existing_users();

-- Função para buscar paciente por código (para profissionais)
CREATE OR REPLACE FUNCTION public.find_patient_by_code(patient_code TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  nome TEXT,
  email TEXT,
  tipo TEXT,
  codigo TEXT
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

  -- Buscar paciente por código
  RETURN QUERY
  SELECT p.id, p.user_id, p.nome, p.email, p.tipo, p.codigo
  FROM profiles p
  WHERE p.codigo = UPPER(patient_code)
  AND p.tipo = 'paciente';
END;
$$;