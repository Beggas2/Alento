-- Sistema de Acompanhamento Clínico para Profissionais de Saúde Mental

-- Enum para tipo de usuário
CREATE TYPE public.user_type AS ENUM ('paciente', 'profissional');

-- Enum para humor (1-10)
CREATE TYPE public.mood_level AS ENUM ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10');

-- Enum para planos de assinatura
CREATE TYPE public.subscription_plan AS ENUM ('basico', 'premium', 'enterprise');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  tipo user_type NOT NULL,
  telefone TEXT,
  crp_crm TEXT, -- Apenas para profissionais
  especialidade TEXT, -- Apenas para profissionais
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de pacientes (dados complementares)
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  profissional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_nascimento DATE,
  genero TEXT,
  endereco TEXT,
  contato_emergencia TEXT,
  historico_clinico TEXT,
  medicamentos_atuais TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de registros diários
CREATE TABLE public.daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  humor mood_level NOT NULL,
  como_se_sentiu TEXT,
  gatilhos TEXT,
  sinal_alerta BOOLEAN DEFAULT false,
  observacoes_profissional TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, data)
);

-- Tabela de alertas clínicos
CREATE TABLE public.clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES public.daily_records(id) ON DELETE CASCADE NOT NULL,
  profissional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  visualizado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plano subscription_plan NOT NULL DEFAULT 'basico',
  pacientes_ativos INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  vencimento TIMESTAMPTZ,
  valor_mensal DECIMAL(10,2) DEFAULT 49.00,
  valor_por_paciente DECIMAL(10,2) DEFAULT 2.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies para patients
CREATE POLICY "Patients can view own data" ON public.patients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Professionals can view their patients" ON public.patients
  FOR SELECT USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

CREATE POLICY "Patients can update own data" ON public.patients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Professionals can update their patients" ON public.patients
  FOR UPDATE USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

CREATE POLICY "Patients can insert own data" ON public.patients
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies para daily_records
CREATE POLICY "Patients can view own records" ON public.daily_records
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can view their patients records" ON public.daily_records
  FOR SELECT USING (
    patient_id IN (
      SELECT p.id FROM public.patients p 
      JOIN public.profiles prof ON p.profissional_id = prof.id 
      WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional'
    )
  );

CREATE POLICY "Patients can insert own records" ON public.daily_records
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can update own records" ON public.daily_records
  FOR UPDATE USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can update their patients records" ON public.daily_records
  FOR UPDATE USING (
    patient_id IN (
      SELECT p.id FROM public.patients p 
      JOIN public.profiles prof ON p.profissional_id = prof.id 
      WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional'
    )
  );

-- RLS Policies para clinical_alerts
CREATE POLICY "Professionals can view their alerts" ON public.clinical_alerts
  FOR SELECT USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

CREATE POLICY "System can insert alerts" ON public.clinical_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Professionals can update their alerts" ON public.clinical_alerts
  FOR UPDATE USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

-- RLS Policies para subscriptions
CREATE POLICY "Professionals can view own subscription" ON public.subscriptions
  FOR SELECT USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

CREATE POLICY "Professionals can update own subscription" ON public.subscriptions
  FOR UPDATE USING (
    profissional_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'profissional'
    )
  );

CREATE POLICY "System can insert subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (true);

-- Função para criar perfil automaticamente após cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo')::user_type, 'paciente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para criar alertas automaticamente quando há sinal de alerta
CREATE OR REPLACE FUNCTION public.create_alert_on_record()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sinal_alerta = true THEN
    INSERT INTO public.clinical_alerts (record_id, profissional_id)
    SELECT NEW.id, p.profissional_id
    FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.profissional_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar alertas
CREATE TRIGGER create_alert_trigger
  AFTER INSERT OR UPDATE ON public.daily_records
  FOR EACH ROW EXECUTE FUNCTION public.create_alert_on_record();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at
  BEFORE UPDATE ON public.daily_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_patients_profissional_id ON public.patients(profissional_id);
CREATE INDEX idx_daily_records_patient_data ON public.daily_records(patient_id, data);
CREATE INDEX idx_clinical_alerts_profissional ON public.clinical_alerts(profissional_id, visualizado);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_tipo ON public.profiles(tipo);