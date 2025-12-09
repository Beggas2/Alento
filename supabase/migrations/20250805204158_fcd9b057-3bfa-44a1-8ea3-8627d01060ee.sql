-- Criar tabela para controle de tomada de medicamentos
CREATE TABLE public.medication_intakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  data_horario TIMESTAMP WITH TIME ZONE NOT NULL,
  tomado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.medication_intakes ENABLE ROW LEVEL SECURITY;

-- Políticas para pacientes
CREATE POLICY "Patients can view their medication intakes" 
ON public.medication_intakes 
FOR SELECT 
USING (patient_id IN (
  SELECT id FROM public.patients 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Patients can insert their medication intakes" 
ON public.medication_intakes 
FOR INSERT 
WITH CHECK (patient_id IN (
  SELECT id FROM public.patients 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Patients can update their medication intakes" 
ON public.medication_intakes 
FOR UPDATE 
USING (patient_id IN (
  SELECT id FROM public.patients 
  WHERE user_id = auth.uid()
));

-- Políticas para profissionais
CREATE POLICY "Professionals can view their patients medication intakes" 
ON public.medication_intakes 
FOR SELECT 
USING (patient_id IN (
  SELECT p.id FROM patients p
  JOIN profiles prof ON p.profissional_id = prof.id
  WHERE prof.user_id = auth.uid() AND prof.tipo = 'profissional'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_medication_intakes_updated_at
BEFORE UPDATE ON public.medication_intakes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();