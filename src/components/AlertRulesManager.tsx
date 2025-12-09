import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AlertTriangle, Plus, TestTube, Trash2, Edit } from 'lucide-react';

interface AlertRulesManagerProps {
  patientId?: string;
}

const METRICS = [
  { value: 'days_without_medication', label: 'Dias sem medicação', type: 'number' },
  { value: 'mood_latest', label: 'Humor atual (1-10)', type: 'number' },
  { value: 'phq9_score', label: 'Pontuação PHQ-9', type: 'number' },
  { value: 'gad7_score', label: 'Pontuação GAD-7', type: 'number' },
  { value: 'sleep_hours_avg_7d', label: 'Média de sono (7 dias)', type: 'number' },
  { value: 'suicide_risk_score', label: 'Risco de suicídio (0-1)', type: 'number' },
  { value: 'checkin_missing_3d', label: 'Check-in perdido (3+ dias)', type: 'boolean' }
];

const OPERATORS = [
  { value: '>', label: 'Maior que (>)' },
  { value: '>=', label: 'Maior ou igual (>=)' },
  { value: '<', label: 'Menor que (<)' },
  { value: '<=', label: 'Menor ou igual (<=)' },
  { value: '==', label: 'Igual (==)' },
  { value: '!=', label: 'Diferente (!=)' },
  { value: 'is_true', label: 'É verdadeiro' },
  { value: 'is_false', label: 'É falso' }
];

export const AlertRulesManager: React.FC<AlertRulesManagerProps> = ({ patientId }) => {
  const { profile } = useAuth();
  const { isEnabled } = useFeatureFlags();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    scope: 'per_patient' as 'global' | 'per_patient',
    patient_id: patientId || '',
    dedup_window_minutes: 1440,
    is_active: true
  });

  // Don't render if not a professional or feature flag disabled
  if (!isEnabled('alert_rules_v1') || profile?.tipo !== 'profissional') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome da regra é obrigatório');
      return;
    }

    // For demo purposes, just show success
    toast.success('Regra criada com sucesso! (Funcionalidade em desenvolvimento)');
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Regras de Alerta Configuráveis</CardTitle>
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Feature Description */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2">Sistema de Alertas Configuráveis</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Configure regras personalizadas para receber alertas automáticos baseados em:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Métricas de humor e questionários (PHQ-9, GAD-7)</li>
              <li>• Padrões de medicação e aderência</li>
              <li>• Ausência de check-ins</li>
              <li>• Qualidade do sono</li>
              <li>• Indicadores de risco</li>
            </ul>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Criar Nova Regra de Alerta</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome da Regra</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Humor baixo sem medicação"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="scope">Escopo</Label>
                      <Select value={formData.scope} onValueChange={(value: 'global' | 'per_patient') => 
                        setFormData(prev => ({ ...prev, scope: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_patient">Por Paciente</SelectItem>
                          <SelectItem value="global">Todos os Pacientes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Exemplo de Regra: Alerta de Risco</Label>
                    <div className="p-3 bg-muted/50 rounded border space-y-2">
                      <div className="text-sm">
                        <strong>SE TODAS as condições forem verdadeiras:</strong>
                      </div>
                      <div className="space-y-1 pl-4 border-l-2 border-warning">
                        <div className="text-sm">• Humor atual &lt; 3 (muito baixo)</div>
                        <div className="text-sm">• Dias sem medicação ≥ 3</div>
                        <div className="text-sm">• Check-in perdido por 3+ dias = verdadeiro</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>ENTÃO:</strong> Criar alerta de alto risco para o profissional
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dedup">Janela de Deduplicação</Label>
                      <Select value="1440" onValueChange={() => {}}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">1 hora</SelectItem>
                          <SelectItem value="360">6 horas</SelectItem>
                          <SelectItem value="720">12 horas</SelectItem>
                          <SelectItem value="1440">24 horas</SelectItem>
                          <SelectItem value="4320">3 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ 
                          ...prev, 
                          is_active: checked 
                        }))}
                      />
                      <Label htmlFor="active">Ativar regra</Label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">
                      Criar Regra (Demo)
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Example Rules */}
          <div className="space-y-3">
            <h4 className="font-medium">Exemplos de Regras Configuráveis:</h4>
            
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-destructive">Alerta de Alto Risco</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="destructive">Ativo</Badge>
                      <Badge variant="outline">Por Paciente</Badge>
                      <span className="text-xs text-muted-foreground">Dedup: 24h</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled>
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <div className="mb-2">
                    <strong>Condições (TODAS devem ser verdadeiras):</strong>
                  </div>
                  <div className="space-y-1">
                    <div className="pl-4 border-l-2 border-muted">
                      Humor atual &lt; 3 (muito baixo)
                    </div>
                    <div className="pl-4 border-l-2 border-muted">
                      Dias sem medicação ≥ 3
                    </div>
                    <div className="pl-4 border-l-2 border-muted">
                      Check-in perdido (3+ dias) = verdadeiro
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-warning">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-warning">Alerta de Aderência à Medicação</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">Ativo</Badge>
                      <Badge variant="outline">Global</Badge>
                      <span className="text-xs text-muted-foreground">Dedup: 12h</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled>
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <div className="mb-2">
                    <strong>Condições (QUALQUER deve ser verdadeira):</strong>
                  </div>
                  <div className="space-y-1">
                    <div className="pl-4 border-l-2 border-muted">
                      Dias sem medicação ≥ 5
                    </div>
                    <div className="pl-4 border-l-2 border-muted">
                      PHQ-9 score &gt; 15 (depressão moderada-severa)
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-blue-600">Alerta de Qualidade do Sono</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">Ativo</Badge>
                      <Badge variant="outline">Global</Badge>
                      <span className="text-xs text-muted-foreground">Dedup: 6h</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled>
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <div className="mb-2">
                    <strong>Condições (TODAS devem ser verdadeiras):</strong>
                  </div>
                  <div className="space-y-1">
                    <div className="pl-4 border-l-2 border-muted">
                      Média de sono (7 dias) &lt; 5 horas
                    </div>
                    <div className="pl-4 border-l-2 border-muted">
                      Humor atual &lt; 5
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Sistema em Desenvolvimento</h4>
                <p className="text-sm text-blue-700 mt-1">
                  O sistema de alertas configuráveis está sendo implementado. As funcionalidades incluirão:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• Editor visual de regras com lógica AND/OR</li>
                  <li>• Teste de regras com dados históricos</li>
                  <li>• Notificações em tempo real e por email</li>
                  <li>• Métricas de eficácia das regras</li>
                  <li>• Templates de regras pré-configuradas</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};