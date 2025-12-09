-- Corrigir search_path nas funções para resolver alertas de segurança
CREATE OR REPLACE FUNCTION public.create_questionnaire_alert()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    patient_professionals_count INTEGER;
    professional_record RECORD;
BEGIN
    -- Verificar se a resposta indica risco (resposta >= threshold)
    IF NEW.response_value >= (
        SELECT risk_threshold 
        FROM questionnaire_questions 
        WHERE id = NEW.question_id 
        AND risk_threshold IS NOT NULL
    ) THEN
        -- Buscar todos os profissionais vinculados ao paciente
        FOR professional_record IN 
            SELECT pp.professional_id
            FROM patient_professionals pp
            WHERE pp.patient_id = NEW.patient_id 
            AND pp.status = 'active'
        LOOP
            -- Criar alerta para cada profissional
            INSERT INTO public.clinical_alerts (
                record_id,
                profissional_id,
                alert_type,
                alert_level,
                ai_analysis
            ) VALUES (
                NEW.daily_record_id,
                professional_record.professional_id,
                'questionnaire_risk',
                'high',
                jsonb_build_object(
                    'questionnaire_response', true,
                    'question_id', NEW.question_id,
                    'response_value', NEW.response_value,
                    'risk_detected', true,
                    'auto_generated', true
                )
            )
            ON CONFLICT (record_id, profissional_id) 
            DO UPDATE SET
                alert_type = EXCLUDED.alert_type,
                alert_level = EXCLUDED.alert_level,
                ai_analysis = EXCLUDED.ai_analysis,
                visualizado = false,
                created_at = now();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restart_completed_questionnaires()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Reiniciar questionários que foram completados há mais de 2 semanas
    UPDATE public.patient_questionnaire_progress
    SET 
        status = 'in_progress',
        current_question = 1,
        questions_answered = 0,
        started_at = now(),
        completed_at = NULL,
        next_cycle_date = NULL
    WHERE 
        status = 'completed' 
        AND next_cycle_date IS NOT NULL 
        AND next_cycle_date <= now();
END;
$$;