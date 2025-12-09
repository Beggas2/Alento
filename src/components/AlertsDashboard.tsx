import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, Clock, Eye, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface AlertInstance {
  id: string;
  rule_id: string;
  patient_id: string;
  triggered_at: string;
  payload_json: any;
  status: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  rule_name?: string;
  patient_name?: string;
}

export const AlertsDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { isEnabled } = useFeatureFlags();
  
  const [alerts, setAlerts] = useState<AlertInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [patientFilter, setPatientFilter] = useState<string>('all');
  const [patients, setPatients] = useState<{id: string, nome: string}[]>([]);

  // Don't render if feature flag disabled or not professional
  if (!isEnabled('alert_rules_v1') || profile?.tipo !== 'profissional') {
    return null;
  }

  useEffect(() => {
    fetchAlerts();
    fetchPatients();
  }, [statusFilter, patientFilter]);

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from('alert_instances')
        .select(`
          *,
          alert_rules!inner(name, owner_user_id)
        `)
        .eq('alert_rules.owner_user_id', profile?.user_id)
        .order('triggered_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (patientFilter !== 'all') {
        query = query.eq('patient_id', patientFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get patient names
      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map(alert => alert.patient_id))];
        
        const { data: patientsData } = await supabase
          .from('patients')
          .select(`
            id,
            profiles!inner(nome, user_id)
          `)
          .in('id', patientIds);

        const alertsWithNames = data.map(alert => ({
          ...alert,
          rule_name: alert.alert_rules?.name,
          patient_name: patientsData?.find(p => p.id === alert.patient_id)?.profiles?.nome || 'Paciente'
        }));

        setAlerts(alertsWithNames);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients!inner(
            id,
            profiles!inner(nome, user_id)
          )
        `)
        .eq('professional_id', profile?.id)
        .eq('status', 'active');

      if (error) throw error;

      const patientsList = data?.map(item => ({
        id: item.patients.id,
        nome: item.patients.profiles.nome
      })) || [];

      setPatients(patientsList);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const updateAlertStatus = async (alertId: string, status: 'ack' | 'closed') => {
    try {
      const { error } = await supabase.functions.invoke('alert-engine', {
        body: {
          action: 'acknowledge_alert',
          alertId,
          status
        }
      });

      if (error) throw error;

      toast.success(status === 'ack' ? 'Alerta reconhecido' : 'Alerta fechado');
      fetchAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
      toast.error('Erro ao atualizar alerta');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="destructive">Novo</Badge>;
      case 'ack':
        return <Badge variant="secondary">Reconhecido</Badge>;
      case 'closed':
        return <Badge variant="outline">Fechado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'border-l-red-500';
      case 'ack':
        return 'border-l-yellow-500';
      case 'closed':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (loading) {
    return <div className="p-4">Carregando alertas...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Dashboard de Alertas
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novos</SelectItem>
                <SelectItem value="ack">Reconhecidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pacientes</SelectItem>
                {patients.map(patient => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card key={alert.id} className={`border-l-4 ${getStatusColor(alert.status)}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{alert.rule_name}</h4>
                      {getStatusBadge(alert.status)}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Paciente:</strong> {alert.patient_name}</p>
                      <p><strong>Disparado em:</strong> {format(new Date(alert.triggered_at), 'dd/MM/yyyy HH:mm')}</p>
                      
                      {alert.payload_json?.metrics && (
                        <div className="mt-2 p-2 bg-muted rounded-md">
                          <p className="text-xs font-medium mb-1">Métricas no momento do alerta:</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(alert.payload_json.metrics).map(([key, value]) => (
                              <span key={key}>
                                {key}: {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {alert.acknowledged_at && (
                        <p><strong>Reconhecido em:</strong> {format(new Date(alert.acknowledged_at), 'dd/MM/yyyy HH:mm')}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.status === 'new' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAlertStatus(alert.id, 'ack')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Reconhecer
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          onClick={() => updateAlertStatus(alert.id, 'closed')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Fechar
                        </Button>
                      </>
                    )}
                    
                    {alert.status === 'ack' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => updateAlertStatus(alert.id, 'closed')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {alerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum alerta encontrado</p>
              {statusFilter !== 'all' || patientFilter !== 'all' ? (
                <p className="text-sm">Tente ajustar os filtros</p>
              ) : (
                <p className="text-sm">Crie regras de alerta para começar</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};