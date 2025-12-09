-- Criar tabela de relacionamento many-to-many entre pacientes e profissionais
CREATE TABLE public.patient_professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(patient_id, professional_id)
);

-- Migrar dados existentes da tabela patients
INSERT INTO public.patient_professionals (patient_id, professional_id)
SELECT id, profissional_id 
FROM public.patients 
WHERE profissional_id IS NOT NULL;

-- Habilitar RLS na nova tabela
ALTER TABLE public.patient_professionals ENABLE ROW LEVEL SECURITY;