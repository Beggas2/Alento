-- Adicionar foreign keys que estão faltando
ALTER TABLE link_requests 
ADD CONSTRAINT link_requests_requester_id_fkey 
FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE link_requests 
ADD CONSTRAINT link_requests_target_id_fkey 
FOREIGN KEY (target_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE clinical_alerts 
ADD CONSTRAINT clinical_alerts_record_id_fkey 
FOREIGN KEY (record_id) REFERENCES daily_records(id) ON DELETE CASCADE;

ALTER TABLE clinical_alerts 
ADD CONSTRAINT clinical_alerts_profissional_id_fkey 
FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE patients 
ADD CONSTRAINT patients_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE patients 
ADD CONSTRAINT patients_profissional_id_fkey 
FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE medications 
ADD CONSTRAINT medications_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE medications 
ADD CONSTRAINT medications_prescrito_por_fkey 
FOREIGN KEY (prescrito_por) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE medication_intakes 
ADD CONSTRAINT medication_intakes_medication_id_fkey 
FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;

ALTER TABLE medication_intakes 
ADD CONSTRAINT medication_intakes_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE daily_records 
ADD CONSTRAINT daily_records_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_profissional_id_fkey 
FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Corrigir função de geração de código para usar a tabela profiles
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
        -- Aguardar um pouco para garantir que os dados estejam salvos
        PERFORM pg_sleep(0.1);
        
        -- Gerar código baseado nos dados do novo registro
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