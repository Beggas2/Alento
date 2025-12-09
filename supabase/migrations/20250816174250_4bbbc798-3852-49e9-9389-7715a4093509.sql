-- Adicionar campo energia aos registros diários
ALTER TABLE public.daily_records 
ADD COLUMN energia integer;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.daily_records.energia IS 'Nível de energia de 1 a 10';