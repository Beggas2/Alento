-- Tabela para solicitações de vinculação
CREATE TABLE public.link_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL, -- quem fez a solicitação (paciente ou profissional)
  target_id UUID NOT NULL, -- quem vai receber a solicitação
  requester_type TEXT NOT NULL CHECK (requester_type IN ('paciente', 'profissional')),
  target_type TEXT NOT NULL CHECK (target_type IN ('paciente', 'profissional')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.link_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para link_requests
CREATE POLICY "Users can view their own requests" 
ON public.link_requests 
FOR SELECT 
USING (
  requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create link requests" 
ON public.link_requests 
FOR INSERT 
WITH CHECK (
  requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their received requests" 
ON public.link_requests 
FOR UPDATE 
USING (
  target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Atualizar tabela profiles para incluir especialidade médica
ALTER TABLE public.profiles 
ADD COLUMN is_medico BOOLEAN DEFAULT false;

-- Trigger para updated_at em link_requests
CREATE TRIGGER update_link_requests_updated_at
BEFORE UPDATE ON public.link_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar solicitação de vinculação
CREATE OR REPLACE FUNCTION public.process_link_request(
  request_id UUID,
  action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Verificar se a solicitação existe e o usuário pode atualizá-la
  SELECT * INTO request_record 
  FROM link_requests 
  WHERE id = request_id 
    AND target_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Atualizar status da solicitação
  UPDATE link_requests 
  SET status = action, updated_at = now()
  WHERE id = request_id;
  
  -- Se aceita, criar vinculação
  IF action = 'accepted' THEN
    IF request_record.requester_type = 'paciente' AND request_record.target_type = 'profissional' THEN
      -- Paciente solicitou para profissional
      UPDATE patients 
      SET profissional_id = request_record.target_id
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.requester_id);
    ELSIF request_record.requester_type = 'profissional' AND request_record.target_type = 'paciente' THEN
      -- Profissional solicitou para paciente
      UPDATE patients 
      SET profissional_id = request_record.requester_id
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = request_record.target_id);
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;