-- Seed default questions for WHO-5 and AUDIT-C if missing
-- WHO-5 questionnaire id
DO $$
DECLARE
  who5 uuid := '7c16e16b-7176-40f6-aa0f-05cf2b3ac51c';
  auditc uuid := '960afe12-b684-4ce7-9491-419be50c1b0e';
BEGIN
  -- Ensure questionnaires exist (no-op updates to assert intent)
  UPDATE questionnaires SET updated_at = now() WHERE id IN (who5, auditc);

  -- WHO-5 (5 questions)
  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT who5, 1, 'Ao longo das últimas duas semanas, senti-me alegre e de bom humor.',
    '["Nunca","Raramente","Às vezes","Frequentemente","Muito frequentemente","Sempre"]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = who5 AND question_number = 1
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT who5, 2, 'Ao longo das últimas duas semanas, senti-me calmo(a) e relaxado(a).',
    '["Nunca","Raramente","Às vezes","Frequentemente","Muito frequentemente","Sempre"]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = who5 AND question_number = 2
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT who5, 3, 'Ao longo das últimas duas semanas, senti-me ativo(a) e cheio(a) de energia.',
    '["Nunca","Raramente","Às vezes","Frequentemente","Muito frequentemente","Sempre"]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = who5 AND question_number = 3
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT who5, 4, 'Ao longo das últimas duas semanas, acordei me sentindo descansado(a) e revigorado(a).',
    '["Nunca","Raramente","Às vezes","Frequentemente","Muito frequentemente","Sempre"]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = who5 AND question_number = 4
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT who5, 5, 'Ao longo das últimas duas semanas, a minha vida diária foi preenchida por coisas que me interessam.',
    '["Nunca","Raramente","Às vezes","Frequentemente","Muito frequentemente","Sempre"]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = who5 AND question_number = 5
  );

  -- AUDIT-C (3 questions)
  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT auditc, 1, 'Com que frequência você consome bebidas alcoólicas?',
    '["Nunca","Menos de uma vez por mês","Mensalmente","Semanalmente","Diariamente ou quase todos os dias"]'::jsonb, 3
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = auditc AND question_number = 1
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT auditc, 2, 'Quantas doses você consome em um dia típico quando bebe?',
    '["1 ou 2","3 ou 4","5 ou 6","7 a 9","10 ou mais"]'::jsonb, 3
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = auditc AND question_number = 2
  );

  INSERT INTO questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold)
  SELECT auditc, 3, 'Com que frequência você consome seis ou mais doses em uma única ocasião?',
    '["Nunca","Menos de uma vez por mês","Mensalmente","Semanalmente","Diariamente ou quase todos os dias"]'::jsonb, 3
  WHERE NOT EXISTS (
    SELECT 1 FROM questionnaire_questions WHERE questionnaire_id = auditc AND question_number = 3
  );
END $$;