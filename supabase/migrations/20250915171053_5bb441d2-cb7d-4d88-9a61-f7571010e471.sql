-- Permitir que profissionais insiram e atualizem configurações de questionários
CREATE POLICY "Professionals can insert questionnaire settings" 
ON public.patient_questionnaire_settings FOR INSERT 
WITH CHECK (
  professional_id IN (
    SELECT profiles.id FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can update questionnaire settings" 
ON public.patient_questionnaire_settings FOR UPDATE 
USING (
  professional_id IN (
    SELECT profiles.id FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.tipo = 'profissional'
  )
);

-- Ajustar trigger de alerta para ignorar quando não houver daily_record_id
CREATE OR REPLACE FUNCTION public.create_questionnaire_alert()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    professional_record RECORD;
    threshold INTEGER;
BEGIN
    -- Se a resposta não estiver vinculada a um daily_record, não criar alerta
    IF NEW.daily_record_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Obter threshold da questão (pode ser NULL)
    SELECT risk_threshold INTO threshold FROM questionnaire_questions WHERE id = NEW.question_id;

    -- Se não houver threshold definido, não criar alerta
    IF threshold IS NULL THEN
      RETURN NEW;
    END IF;

    -- Verificar se a resposta indica risco
    IF NEW.response_value >= threshold THEN
        -- Criar alerta para cada profissional vinculado ao paciente
        FOR professional_record IN 
            SELECT pp.professional_id
            FROM patient_professionals pp
            WHERE pp.patient_id = NEW.patient_id 
              AND pp.status = 'active'
        LOOP
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