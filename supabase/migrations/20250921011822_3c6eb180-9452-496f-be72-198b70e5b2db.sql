-- Create patient metrics view for rule evaluation (fixed aggregation)
CREATE OR REPLACE VIEW public.patient_metrics AS
SELECT 
  p.id as patient_id,
  p.user_id,
  -- Days without medication
  COALESCE(
    EXTRACT(DAY FROM (now() - MAX(mi.data_horario)))::integer,
    999
  ) as days_without_medication,
  
  -- Latest mood score (convert enum to integer)
  (
    SELECT 
      CASE dr.humor::text
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        WHEN '4' THEN 4
        WHEN '5' THEN 5
        WHEN '6' THEN 6
        WHEN '7' THEN 7
        WHEN '8' THEN 8
        WHEN '9' THEN 9
        WHEN '10' THEN 10
        ELSE 5
      END
    FROM daily_records dr
    WHERE dr.patient_id = p.id
    ORDER BY dr.created_at DESC
    LIMIT 1
  ) as mood_latest,
  
  -- Average sleep hours (last 7 days)
  (
    SELECT AVG(dr.sleep_hours)
    FROM daily_records dr
    WHERE dr.patient_id = p.id
    AND dr.created_at >= now() - interval '7 days'
    AND dr.sleep_hours IS NOT NULL
  ) as sleep_hours_avg_7d,
  
  -- Check if missing checkin for 3+ days
  CASE WHEN (
    SELECT MAX(dr.created_at)
    FROM daily_records dr
    WHERE dr.patient_id = p.id
  ) < now() - interval '3 days' THEN true ELSE false END as checkin_missing_3d,
  
  -- PHQ-9 score (latest complete questionnaire)
  (
    SELECT questionnaire_sum.total_score
    FROM (
      SELECT SUM(qr.response_value) as total_score, qr.answered_at
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.patient_id = p.id
      AND q.code = 'PHQ9'
      AND qr.answered_at >= now() - interval '30 days'
      GROUP BY qr.daily_record_id, qr.answered_at
      ORDER BY qr.answered_at DESC
      LIMIT 1
    ) questionnaire_sum
  ) as phq9_score,
  
  -- GAD-7 score (latest complete questionnaire)
  (
    SELECT questionnaire_sum.total_score
    FROM (
      SELECT SUM(qr.response_value) as total_score, qr.answered_at
      FROM questionnaire_responses qr
      JOIN questionnaires q ON qr.questionnaire_id = q.id
      WHERE qr.patient_id = p.id
      AND q.code = 'GAD7'
      AND qr.answered_at >= now() - interval '30 days'
      GROUP BY qr.daily_record_id, qr.answered_at
      ORDER BY qr.answered_at DESC
      LIMIT 1
    ) questionnaire_sum
  ) as gad7_score,
  
  -- Suicide risk score (calculation based on mood and PHQ-9)
  CASE 
    WHEN (
      SELECT 
        CASE dr.humor::text
          WHEN '1' THEN 1
          WHEN '2' THEN 2
          WHEN '3' THEN 3
          WHEN '4' THEN 4
          WHEN '5' THEN 5
          WHEN '6' THEN 6
          WHEN '7' THEN 7
          WHEN '8' THEN 8
          WHEN '9' THEN 9
          WHEN '10' THEN 10
          ELSE 5
        END
      FROM daily_records dr
      WHERE dr.patient_id = p.id
      ORDER BY dr.created_at DESC
      LIMIT 1
    ) <= 2 THEN 0.8
    WHEN (
      SELECT questionnaire_sum.total_score
      FROM (
        SELECT SUM(qr.response_value) as total_score, qr.answered_at
        FROM questionnaire_responses qr
        JOIN questionnaires q ON qr.questionnaire_id = q.id
        WHERE qr.patient_id = p.id
        AND q.code = 'PHQ9'
        AND qr.answered_at >= now() - interval '30 days'
        GROUP BY qr.daily_record_id, qr.answered_at
        ORDER BY qr.answered_at DESC
        LIMIT 1
      ) questionnaire_sum
    ) >= 20 THEN 0.7
    ELSE 0.1
  END as suicide_risk_score

FROM patients p
LEFT JOIN medication_intakes mi ON p.id = mi.patient_id 
  AND mi.tomado = true 
  AND mi.data_horario >= now() - interval '30 days'
GROUP BY p.id, p.user_id;