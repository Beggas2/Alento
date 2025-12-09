-- Criar tabela de questionários
CREATE TABLE public.questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  total_questions INTEGER NOT NULL,
  active_by_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir questionários padrão
INSERT INTO public.questionnaires (name, code, description, total_questions, active_by_default) VALUES
('PHQ-9 (Depressão)', 'PHQ9', 'Questionário de Saúde do Paciente - 9 itens para depressão', 9, true),
('GAD-7 (Ansiedade)', 'GAD7', 'Transtorno de Ansiedade Generalizada - 7 itens', 7, true),
('MDQ (Transtorno Bipolar)', 'MDQ', 'Questionário de Transtorno do Humor', 13, false),
('PCL-5 (TEPT)', 'PCL5', 'Lista de Verificação de TEPT para DSM-5', 20, false),
('AUDIT-C (Álcool)', 'AUDITC', 'Teste de Identificação de Transtornos Devido ao Uso de Álcool', 3, false),
('WHO-5 (Bem-estar)', 'WHO5', 'Índice de Bem-Estar da OMS', 5, false);

-- Criar tabela de perguntas dos questionários
CREATE TABLE public.questionnaire_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  risk_threshold INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir perguntas do PHQ-9
INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 1, 'Pouco interesse ou pouco prazer em fazer as coisas', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 2, 'Se sentir para baixo, deprimido(a) ou sem perspectiva', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 3, 'Dificuldade para pegar no sono ou permanecer dormindo, ou dormir demais', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 4, 'Se sentir cansado(a) ou com pouca energia', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 5, 'Falta de apetite ou comer demais', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 6, 'Se sentir mal consigo mesmo(a) - ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo(a)', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 7, 'Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 8, 'Lentidão para se mover ou falar, a ponto das outras pessoas perceberem? Ou o oposto - estar tão agitado(a) ou irrequieto(a) que você fica andando de um lado para o outro muito mais do que de costume', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'PHQ9';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 9, 'Pensar em se ferir de alguma maneira ou que seria melhor estar morto(a)', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 1
FROM public.questionnaires WHERE code = 'PHQ9';

-- Inserir perguntas do GAD-7
INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 1, 'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 2, 'Não conseguir parar ou controlar as preocupações', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 3, 'Preocupar-se muito com diversas coisas', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 4, 'Dificuldade para relaxar', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 5, 'Ficar tão agitado(a) que se torna difícil ficar parado(a)', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 6, 'Ficar facilmente aborrecido(a) ou irritado(a)', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

INSERT INTO public.questionnaire_questions (questionnaire_id, question_number, question_text, options, risk_threshold) 
SELECT id, 7, 'Sentir medo, como se algo terrível fosse acontecer', 
'["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"]'::jsonb, 2
FROM public.questionnaires WHERE code = 'GAD7';

-- Criar tabela de configurações de questionários por paciente
CREATE TABLE public.patient_questionnaire_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, professional_id, questionnaire_id)
);

-- Criar tabela de progresso dos questionários
CREATE TABLE public.patient_questionnaire_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  current_question INTEGER NOT NULL DEFAULT 1,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_cycle_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, questionnaire_id)
);

-- Criar tabela de respostas dos questionários
CREATE TABLE public.questionnaire_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questionnaire_questions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  response_value INTEGER NOT NULL,
  response_text TEXT,
  daily_record_id UUID REFERENCES public.daily_records(id) ON DELETE SET NULL,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_questionnaire_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_questionnaire_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for questionnaires (public read)
CREATE POLICY "Questionnaires are viewable by everyone" 
ON public.questionnaires FOR SELECT USING (true);

-- RLS Policies for questionnaire_questions (public read)
CREATE POLICY "Questionnaire questions are viewable by everyone" 
ON public.questionnaire_questions FOR SELECT USING (true);

-- RLS Policies for patient_questionnaire_settings
CREATE POLICY "Professionals can manage their patient questionnaire settings" 
ON public.patient_questionnaire_settings FOR ALL 
USING (
  professional_id IN (
    SELECT profiles.id FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.tipo = 'profissional'
  )
);

CREATE POLICY "Patients can view their questionnaire settings" 
ON public.patient_questionnaire_settings FOR SELECT 
USING (
  patient_id IN (
    SELECT patients.id FROM patients 
    WHERE patients.user_id = auth.uid()
  )
);

-- RLS Policies for patient_questionnaire_progress
CREATE POLICY "Patients can view and update their questionnaire progress" 
ON public.patient_questionnaire_progress FOR ALL 
USING (
  patient_id IN (
    SELECT patients.id FROM patients 
    WHERE patients.user_id = auth.uid()
  )
);

CREATE POLICY "Professionals can view their patients questionnaire progress" 
ON public.patient_questionnaire_progress FOR SELECT 
USING (
  patient_id IN (
    SELECT pp.patient_id FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

-- RLS Policies for questionnaire_responses
CREATE POLICY "Patients can insert and view their questionnaire responses" 
ON public.questionnaire_responses FOR ALL 
USING (
  patient_id IN (
    SELECT patients.id FROM patients 
    WHERE patients.user_id = auth.uid()
  )
);

CREATE POLICY "Professionals can view their patients questionnaire responses" 
ON public.questionnaire_responses FOR SELECT 
USING (
  patient_id IN (
    SELECT pp.patient_id FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional' AND pp.status = 'active'
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_questionnaires_updated_at 
  BEFORE UPDATE ON public.questionnaires 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_questionnaire_settings_updated_at 
  BEFORE UPDATE ON public.patient_questionnaire_settings 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_questionnaire_progress_updated_at 
  BEFORE UPDATE ON public.patient_questionnaire_progress 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();