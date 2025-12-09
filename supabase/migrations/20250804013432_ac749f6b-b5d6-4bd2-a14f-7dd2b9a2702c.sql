-- Criar tabela de medicamentos
CREATE TABLE public.medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescrito_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_medicamento TEXT NOT NULL,
  dosagem TEXT NOT NULL,
  frequencia INTEGER NOT NULL DEFAULT 1,
  horarios TEXT[] NOT NULL DEFAULT '{}',
  data_inicio DATE NOT NULL,
  data_fim DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Políticas para pacientes
CREATE POLICY "Patients can view their medications" 
ON public.medications 
FOR SELECT 
USING (patient_id IN (
  SELECT id FROM public.patients WHERE user_id = auth.uid()
));

-- Políticas para profissionais
CREATE POLICY "Professionals can view medications they prescribed" 
ON public.medications 
FOR SELECT 
USING (prescrito_por IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid() AND tipo = 'profissional'
));

CREATE POLICY "Professionals can insert medications for their patients" 
ON public.medications 
FOR INSERT 
WITH CHECK (
  prescrito_por IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid() AND tipo = 'profissional'
  ) AND
  patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.profiles prof ON p.profissional_id = prof.id
    WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can update medications they prescribed" 
ON public.medications 
FOR UPDATE 
USING (prescrito_por IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid() AND tipo = 'profissional'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON public.medications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();