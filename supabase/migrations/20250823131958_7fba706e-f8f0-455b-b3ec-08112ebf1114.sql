-- Corrigir códigos existentes para médicos
UPDATE profiles 
SET codigo = REPLACE(codigo, 'PS', 'PM')
WHERE tipo = 'profissional' 
AND (especialidade ILIKE '%médic%' OR especialidade ILIKE '%psiquiat%' OR crp_crm ILIKE 'crm%')
AND codigo LIKE 'PS%';

-- Executar função para gerar códigos para usuários sem código
SELECT generate_codes_for_existing_users();

-- Verificar se o trigger existe e criar se não existir
DROP TRIGGER IF EXISTS assign_user_code_trigger ON profiles;

CREATE TRIGGER assign_user_code_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_user_code();