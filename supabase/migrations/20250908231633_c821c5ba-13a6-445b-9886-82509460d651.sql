-- Adicionar foreign keys para a tabela patient_professionals
ALTER TABLE public.patient_professionals
ADD CONSTRAINT patient_professionals_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.patient_professionals
ADD CONSTRAINT patient_professionals_professional_id_fkey 
FOREIGN KEY (professional_id) REFERENCES public.profiles(id) ON DELETE CASCADE;