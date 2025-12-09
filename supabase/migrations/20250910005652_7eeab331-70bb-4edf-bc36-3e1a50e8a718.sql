-- Adicionar campos para análise de IA na tabela clinical_alerts
ALTER TABLE clinical_alerts 
ADD COLUMN IF NOT EXISTS alert_type TEXT,
ADD COLUMN IF NOT EXISTS alert_level TEXT CHECK (alert_level IN ('baixo', 'medio', 'alto')),
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_alert_level ON clinical_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_alert_type ON clinical_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_analyzed_at ON clinical_alerts(analyzed_at);