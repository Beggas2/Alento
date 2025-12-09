import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingDown,
  Heart,
  Moon,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Alert {
  id: string;
  profissional_id: string;
  record_id: string;
  visualizado: boolean;
  created_at: string;
  alert_type?: string;
  alert_level?: string;
  ai_analysis?: {
    keyWords?: string[];
    recommendation?: string;
    confidence?: string;
  };
  analyzed_at?: string;
  patient?: {
    nome: string;
    email: string;
  };
  record?: {
    como_se_sentiu: string;
    humor: string;
    sinal_alerta: boolean;
  };
}

const Alertas = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  useEffect(() => {
    if (profile?.tipo === 'profissional') {
      fetchAlerts();
    }
  }, [profile, filter]);

  const fetchAlerts = async () => {
    try {
      // Passo 1: buscar somente os alertas do profissional (sem INNER JOIN para não filtrar nada por RLS)
      let baseQuery = supabase
        .from('clinical_alerts')
        .select('*')
        .eq('profissional_id', profile?.id)
        .order('created_at', { ascending: false });

      if (filter === 'resolved') {
        baseQuery = baseQuery.eq('visualizado', true);
      } else if (filter === 'active') {
        baseQuery = baseQuery.eq('visualizado', false);
      }
      // Para 'all', não aplicamos filtro de visualizado

      const { data: alertsData, error: alertsError } = await baseQuery;
      if (alertsError) throw alertsError;

      console.log('Dados dos alertas (sem join):', alertsData);

      // Se não há alertas, finalizar cedo
      if (!alertsData || alertsData.length === 0) {
        setAlerts([]);
        return;
      }

      // Passo 2: buscar os registros relacionados em uma segunda chamada (LEFT EMBED por padrão)
      const recordIds = alertsData.map((a: any) => a.record_id).filter(Boolean);

      let recordsById: Record<string, any> = {};
      if (recordIds.length > 0) {
        const { data: recordsData, error: recordsError } = await supabase
          .from('daily_records')
          .select(`
            id,
            como_se_sentiu,
            humor,
            sinal_alerta,
            patient_id,
            patients (
              user_id,
              profiles (
                nome,
                email
              )
            )
          `)
          .in('id', recordIds);

        if (recordsError) throw recordsError;
        console.log('Registros relacionados:', recordsData);
        recordsById = (recordsData || []).reduce((acc: any, rec: any) => {
          acc[rec.id] = rec;
          return acc;
        }, {});
      }

      // Passo 3: montar estrutura final, parseando ai_analysis quando necessário
      const processedAlerts = (alertsData || []).map((alert: any) => {
        const record = recordsById[alert.record_id];
        const patientData = record?.patients?.profiles;

        let aiAnalysis: any = alert.ai_analysis;
        if (typeof aiAnalysis === 'string') {
          try { aiAnalysis = JSON.parse(aiAnalysis); } catch {}
        }

        return {
          id: alert.id,
          profissional_id: alert.profissional_id,
          record_id: alert.record_id,
          visualizado: alert.visualizado,
          created_at: alert.created_at,
          alert_type: alert.alert_type,
          alert_level: alert.alert_level,
          ai_analysis: aiAnalysis,
          analyzed_at: alert.analyzed_at,
          patient: {
            nome: patientData?.nome || 'Nome não encontrado',
            email: patientData?.email || 'Email não encontrado'
          },
          record: {
            como_se_sentiu: record?.como_se_sentiu || 'Registro analisado pela IA',
            humor: record?.humor || '5',
            sinal_alerta: record?.sinal_alerta || false
          }
        } as Alert;
      });

      console.log('Alertas processados:', processedAlerts);
      setAlerts(processedAlerts);
    } catch (error: any) {
      console.error('Erro ao carregar alertas:', error);
      toast({
        title: 'Erro ao carregar alertas',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('clinical_alerts')
        .update({
          visualizado: true
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alerta resolvido",
        description: "O alerta foi marcado como visualizado."
      });

      fetchAlerts();
    } catch (error: any) {
      toast({
        title: "Erro ao resolver alerta",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getAlertSeverity = (alert: Alert) => {
    // Priorizar dados da análise de IA se disponível
    if (alert.alert_level) {
      return alert.alert_level === 'alto' ? 'high' : 
             alert.alert_level === 'medio' ? 'medium' : 'low';
    }
    
    // Fallback para lógica anterior
    if (!alert.record?.sinal_alerta) return 'low';
    const humor = parseInt(alert.record.humor || '5');
    if (humor <= 3) return 'high';
    if (humor <= 5) return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-health-danger/10 text-health-danger border-health-danger/20';
      case 'medium': return 'bg-health-warning/10 text-health-warning border-health-warning/20';
      case 'low': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return 'Alto Risco';
      case 'medium': return 'Risco Médio';
      case 'low': return 'Baixo Risco';
      default: return severity;
    }
  };

  const getAlertTypeLabel = (type?: string) => {
    switch (type) {
      case 'suicidio': return 'Risco de Suicídio';
      case 'autolesao': return 'Risco de Autolesão';
      case 'crise': return 'Crise Psicológica';
      case 'depressao': return 'Depressão Severa';
      case 'ansiedade_severa': return 'Ansiedade Severa';
      default: return 'Alerta de Registro';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Alertas Clínicos</h2>
            </div>
          </div>
        </header>
        <div className="p-6 text-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  const activeAlerts = alerts.filter(alert => !alert.visualizado);
  const resolvedAlerts = alerts.filter(alert => alert.visualizado);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-auto min-h-14 items-center px-4 py-2">
          <SidebarTrigger />
          <div className="ml-4 flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">Alertas Clínicos</h2>
          </div>
        </div>
        {/* Mobile filter buttons */}
        <div className="flex gap-1 px-4 pb-2 overflow-x-auto">
          <Button 
            variant={filter === 'active' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('active')}
            className="whitespace-nowrap"
          >
            <span className="hidden sm:inline">Não Visualizados</span>
            <span className="sm:hidden">Ativos</span> ({activeAlerts.length})
          </Button>
          <Button 
            variant={filter === 'resolved' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('resolved')}
            className="whitespace-nowrap"
          >
            <span className="hidden sm:inline">Visualizados</span>
            <span className="sm:hidden">Resolvidos</span> ({resolvedAlerts.length})
          </Button>
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
            className="whitespace-nowrap"
          >
            Todos
          </Button>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Não Visualizados</p>
                  <p className="text-lg sm:text-2xl font-bold text-health-danger">{activeAlerts.length}</p>
                </div>
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-health-danger flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Visualizados Hoje</p>
                  <p className="text-lg sm:text-2xl font-bold text-health-success">
                    {resolvedAlerts.filter(alert => 
                      new Date(alert.created_at).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-health-success flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 sm:pt-6 pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Alta Prioridade</p>
                  <p className="text-lg sm:text-2xl font-bold text-health-warning">
                    {activeAlerts.filter(alert => getAlertSeverity(alert) === 'high').length}
                  </p>
                </div>
                <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-health-warning flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Alertas */}
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-health-success opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {filter === 'active' ? 'Nenhum alerta não visualizado' : 'Nenhum alerta encontrado'}
                </h3>
                <p className="text-muted-foreground">
                  {filter === 'active' 
                    ? 'Todos os alertas foram visualizados!' 
                    : 'Não há alertas para exibir.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const severity = getAlertSeverity(alert);
                
                return (
                  <Card key={alert.id} className={!alert.visualizado ? 'border-l-4 border-l-health-danger' : ''}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            severity === 'high' ? 'bg-health-danger/10' :
                            severity === 'medium' ? 'bg-health-warning/10' :
                            'bg-blue-50'
                          }`}>
                            <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 ${
                              severity === 'high' ? 'text-health-danger' :
                              severity === 'medium' ? 'text-health-warning' :
                              'text-blue-600'
                            }`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 mb-2">
                              <h4 className="font-medium text-sm sm:text-base truncate">{getAlertTypeLabel(alert.alert_type)}</h4>
                              <Badge variant="outline" className={`${getSeverityColor(severity)} text-xs`}>
                                {getSeverityLabel(severity)}
                              </Badge>
                              {alert.ai_analysis && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  IA
                                </Badge>
                              )}
                              {alert.visualizado && (
                                <Badge variant="outline" className="bg-health-success/10 text-health-success border-health-success/20 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Visualizado</span>
                                  <span className="sm:hidden">Ok</span>
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-foreground mb-2 line-clamp-2">
                              {alert.record?.como_se_sentiu || 'Registro analisado pela IA'}
                            </p>

                            {/* Recomendações da IA */}
                            {alert.ai_analysis?.recommendation && (
                              <div className="bg-blue-50 p-2 sm:p-3 rounded-md mb-2">
                                <p className="text-xs sm:text-sm font-medium text-blue-900 mb-1">Recomendação da IA:</p>
                                <p className="text-xs sm:text-sm text-blue-800 line-clamp-3">{alert.ai_analysis.recommendation}</p>
                                {alert.ai_analysis.keyWords && alert.ai_analysis.keyWords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {alert.ai_analysis.keyWords.slice(0, 3).map((word, index) => (
                                      <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                        {word}
                                      </Badge>
                                    ))}
                                    {alert.ai_analysis.keyWords.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{alert.ai_analysis.keyWords.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                              <span className="truncate">Paciente: {alert.patient?.nome || 'N/A'}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="hidden sm:inline">
                                  {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                <span className="sm:hidden">
                                  {format(new Date(alert.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              </span>
                              {alert.analyzed_at && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                  <span className="hidden sm:inline">
                                    Análise: {format(new Date(alert.analyzed_at), "HH:mm", { locale: ptBR })}
                                  </span>
                                  <span className="sm:hidden">
                                    {format(new Date(alert.analyzed_at), "HH:mm", { locale: ptBR })}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {!alert.visualizado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert(alert.id)}
                            className="text-health-success border-health-success hover:bg-health-success hover:text-white w-full sm:w-auto"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Marcar como Visto</span>
                            <span className="sm:hidden">Marcar</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alertas;