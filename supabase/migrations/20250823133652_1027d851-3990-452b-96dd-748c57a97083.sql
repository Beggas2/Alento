-- Corrigir códigos dos médicos para usar prefixo PM
UPDATE profiles 
SET codigo = REPLACE(codigo, 'PS', 'PM') 
WHERE tipo = 'profissional' AND is_medico = true;

-- Verificar se há médicos marcados incorretamente como psicólogos
UPDATE profiles 
SET is_medico = true,
    codigo = REPLACE(codigo, 'PS', 'PM')
WHERE tipo = 'profissional' 
  AND (especialidade ILIKE '%medic%' OR especialidade ILIKE '%psiquiatr%');

-- Corrigir função para gerar códigos corretos
CREATE OR REPLACE FUNCTION assign_user_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    prefix TEXT;
    next_number INTEGER;
BEGIN
    -- Determinar o prefixo baseado no tipo e se é médico
    IF NEW.tipo = 'profissional' THEN
        IF NEW.is_medico = true THEN
            prefix := 'PM';
        ELSE
            prefix := 'PS';
        END IF;
    ELSE
        prefix := 'PC';
    END IF;
    
    -- Encontrar o próximo número disponível para o prefixo
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM LENGTH(prefix) + 1) AS INTEGER)), 0) + 1
    INTO next_number
    FROM profiles
    WHERE codigo LIKE prefix || '%';
    
    -- Gerar o novo código
    new_code := prefix || LPAD(next_number::TEXT, 6, '0');
    NEW.codigo := new_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;