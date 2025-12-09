-- Corrigir warnings de segurança das funções (search_path)

-- Recriar função handle_new_user com search_path seguro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo')::public.user_type, 'paciente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar função create_alert_on_record com search_path seguro
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar função update_updated_at_column com search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;