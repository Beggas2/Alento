-- Corrigir função de geração de código
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    prefix TEXT;
    new_code TEXT;
    counter INTEGER := 1;
    max_attempts INTEGER := 1000;
    user_tipo TEXT;
    user_especialidade TEXT;
    user_crm TEXT;
BEGIN
    -- Buscar informações do usuário atual
    SELECT tipo, especialidade, crp_crm INTO user_tipo, user_especialidade, user_crm
    FROM profiles 
    WHERE user_id = auth.uid();
    
    -- Determinar o prefixo baseado no tipo de usuário
    IF user_tipo = 'profissional' THEN
        IF user_especialidade ILIKE '%médic%' OR user_especialidade ILIKE '%psiquiat%' OR user_crm ILIKE 'crm%' THEN
            prefix := 'PM';
        ELSE
            prefix := 'PS';
        END IF;
    ELSIF user_tipo = 'paciente' THEN
        prefix := 'PC';
    ELSE
        prefix := 'US';
    END IF;
    
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
$function$;

-- Atualizar trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION public.assign_user_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Se o código não foi fornecido, gerar automaticamente
    IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
        DECLARE
            prefix TEXT;
            new_code TEXT;
            counter INTEGER := 1;
        BEGIN
            -- Determinar prefixo
            IF NEW.tipo = 'profissional' THEN
                IF NEW.especialidade ILIKE '%médic%' OR NEW.especialidade ILIKE '%psiquiat%' OR NEW.crp_crm ILIKE 'crm%' THEN
                    prefix := 'PM';
                ELSE
                    prefix := 'PS';
                END IF;
            ELSIF NEW.tipo = 'paciente' THEN
                prefix := 'PC';
            ELSE
                prefix := 'US';
            END IF;
            
            -- Encontrar próximo código disponível
            LOOP
                new_code := prefix || LPAD(counter::TEXT, 6, '0');
                EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE codigo = new_code);
                counter := counter + 1;
            END LOOP;
            
            NEW.codigo := new_code;
        END;
    END IF;
    RETURN NEW;
END;
$function$;

-- Criar trigger para gerar códigos automaticamente
DROP TRIGGER IF EXISTS profiles_assign_code_trigger ON profiles;
CREATE TRIGGER profiles_assign_code_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_user_code();

-- Atualizar perfis sem código
UPDATE profiles 
SET codigo = NULL 
WHERE codigo IS NULL OR codigo = '';

-- Gerar códigos para usuários existentes sem código
DO $$
DECLARE
    user_record RECORD;
    prefix TEXT;
    counter INTEGER;
    new_code TEXT;
BEGIN
    FOR user_record IN 
        SELECT id, tipo, especialidade, crp_crm, created_at 
        FROM profiles 
        WHERE codigo IS NULL OR codigo = ''
        ORDER BY tipo, created_at
    LOOP
        -- Determinar o prefixo
        IF user_record.tipo = 'profissional' THEN
            IF user_record.especialidade ILIKE '%médic%' OR 
               user_record.especialidade ILIKE '%psiquiat%' OR 
               user_record.crp_crm ILIKE 'crm%' THEN
                prefix := 'PM';
            ELSE
                prefix := 'PS';
            END IF;
        ELSIF user_record.tipo = 'paciente' THEN
            prefix := 'PC';
        ELSE
            prefix := 'US';
        END IF;
        
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
END $$;