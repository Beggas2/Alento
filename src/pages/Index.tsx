import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell, TrendingUp, Users, Calendar, Activity, AlertTriangle, Heart, Brain, ChevronRight, User, UserCheck, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LinkPatientDialog } from '@/components/LinkPatientDialog';
import { LinkRequestsNotifications } from '@/components/LinkRequestsNotifications';
import { ProfessionalProfileDialog } from '@/components/ProfessionalProfileDialog';

interface DashboardData {
  totalPatients: number;
  activePatients: number;
  responseRate: number;
  recentAlerts: { id: string; patient_name: string; created_at: string }[];
  recentPatients: { id: string; nome: string; created_at: string }[];
  upcomingAppointments: number;
  todayRecords: number;
}

interface ProfessionalInfo {
  id: string;
  nome: string;
  especialidade: string | null;
  codigo: string;
  is_medico: boolean;
  crp_crm: string | null;
  telefone: string | null;
  email: string | null;
  clinica: string | null;
  endereco: string | null;
  bio: string | null;
  foto_perfil_url: string | null;
  logo_clinica_url: string | null;
}

interface PatientData {
  professionals: ProfessionalInfo[];
  recentRecords: any[];
  linkRequests: any[];
}

const Index = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<ProfessionalInfo | null>(null);
  const [showProfessionalDialog, setShowProfessionalDialog] = useState(false);

  const isProfessional = profile?.tipo === 'profissional';

  useEffect(() => {
    if (isProfessional) {
      fetchProfessionalData();
    } else {
      fetchPatientData();
    }
  }, [profile]);

  const fetchProfessionalData = async () => {
    try {
      if (!profile?.id) return;

      console.log('Buscando dados do profissional:', profile.id);

      // Buscar pacientes vinculados através da nova estrutura
      const { data: linkedPatients, error: patientsError } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          status,
          created_at,
          patients(
            id,
            user_id,
            created_at
          )
        `)
        .eq('professional_id', profile.id)
        .eq('status', 'active');

      if (patientsError) {
        console.error('Erro ao buscar pacientes:', patientsError);
        return;
      }

      console.log('Pacientes vinculados encontrados:', linkedPatients);

      // Buscar os perfis dos pacientes separadamente
      let patients = [];
      if (linkedPatients && linkedPatients.length > 0) {
        const userIds = linkedPatients
          .map(link => link.patients?.user_id)
          .filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('nome, codigo, user_id')
            .in('user_id', userIds);

          if (profilesError) {
            console.error('Erro ao buscar perfis:', profilesError);
            return;
          }

          // Combinar dados
          patients = linkedPatients.map(link => {
            if (!link.patients) return null;
            return {
              ...link.patients,
              profiles: profilesData?.find(profile => profile.user_id === link.patients?.user_id)
            };
          }).filter(patient => patient && patient.profiles);
        }
      }

      // Buscar alertas clínicos recentes com informações do paciente
      const { data: alerts, error: alertsError } = await supabase
        .from('clinical_alerts')
        .select('*')
        .eq('profissional_id', profile.id)
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Erro ao buscar alertas:', alertsError);
      }

      // Buscar informações dos pacientes para os alertas
      let alertsWithPatientNames = [];
      if (alerts && alerts.length > 0) {
        const recordIds = alerts.map(alert => alert.record_id);
        
        const { data: recordsData, error: recordsError } = await supabase
          .from('daily_records')
          .select(`
            id,
            patient_id,
            patients(
              user_id
            )
          `)
          .in('id', recordIds);

        if (!recordsError && recordsData) {
          // Buscar os perfis (nomes) dos pacientes via user_id
          const userIds = recordsData
            .map(r => r.patients?.user_id)
            .filter((id): id is string => Boolean(id));

          let profilesMap = new Map<string, string>();
          if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('user_id, nome')
              .in('user_id', userIds);

            if (profilesError) {
              console.error('Erro ao buscar perfis dos pacientes:', profilesError);
            } else if (profilesData) {
              profilesMap = new Map(profilesData.map(p => [p.user_id, p.nome]));
            }
          }

          alertsWithPatientNames = alerts.map(alert => {
            const record = recordsData.find(r => r.id === alert.record_id);
            const userId = record?.patients?.user_id as string | undefined;
            const patientName = (userId && profilesMap.get(userId)) || 'Paciente não encontrado';
            
            return {
              id: alert.id,
              patient_name: patientName,
              created_at: alert.created_at
            };
          });
        }
      }

      // Buscar registros diários de hoje
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayRecordsData, error: todayRecordsError } = await supabase
        .from('daily_records')
        .select('*')
        .eq('data', today);

      if (todayRecordsError) {
        console.error('Erro ao buscar registros de hoje:', todayRecordsError);
      }

      // Simulação de compromissos futuros (substitua com sua lógica real)
      const upcomingAppointments = 5;

      // Calcular taxa de resposta real baseada nos registros dos últimos 7 dias
      let responseRate = 0;
      if (patients && patients.length > 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoDate = format(weekAgo, 'yyyy-MM-dd');
        
        const { data: recentRecords, error: recentRecordsError } = await supabase
          .from('daily_records')
          .select('patient_id')
          .gte('data', weekAgoDate)
          .in('patient_id', patients.map(p => p.id));

        console.log('Pacientes:', patients.map(p => p.id));
        console.log('Registros recentes encontrados:', recentRecords);

        if (!recentRecordsError && recentRecords) {
          const patientsWithRecords = new Set(recentRecords.map(r => r.patient_id));
          responseRate = Math.round((patientsWithRecords.size / patients.length) * 100);
          console.log('Taxa de resposta calculada:', responseRate, `(${patientsWithRecords.size}/${patients.length})`);
        }
      }

      // Calcular estatísticas
      const totalPatients = patients?.length || 0;
      const activePatients = patients?.length || 0;

      setDashboardData({
        totalPatients,
        activePatients,
        responseRate,
        recentAlerts: alertsWithPatientNames?.slice(0, 5) || [],
        recentPatients: patients?.slice(0, 5).map(patient => ({
          id: patient.id,
          nome: patient.profiles?.nome || 'Nome não disponível',
          created_at: patient.created_at
        })) || [],
        upcomingAppointments,
        todayRecords: todayRecordsData?.length || 0
      });

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientData = async () => {
    try {
      if (!profile?.user_id) return;

      console.log('Buscando dados do paciente:', profile.user_id);

      // Buscar informações do paciente
      const { data: patientRecord, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile?.user_id)
        .maybeSingle();

      if (patientError) {
        console.error('Erro ao buscar dados do paciente:', patientError);
        return;
      }

      console.log('Dados do paciente encontrados:', patientRecord);

      // Buscar profissionais vinculados através da nova estrutura
      let professionalsData = [];
      if (patientRecord?.id) {
        console.log('Buscando profissionais vinculados para paciente:', patientRecord.id);
        
        const { data: linkedProfessionals, error: professionalsError } = await supabase
          .from('patient_professionals')
          .select(`
            professional_id,
            status,
            profiles!patient_professionals_professional_id_fkey(
              id,
              nome, 
              codigo, 
              especialidade, 
              is_medico,
              crp_crm,
              telefone,
              email,
              clinica,
              endereco,
              bio,
              foto_perfil_url,
              logo_clinica_url
            )
          `)
          .eq('patient_id', patientRecord.id)
          .eq('status', 'active');

        console.log('Profissionais vinculados encontrados:', linkedProfessionals);
        console.log('Erro ao buscar profissionais:', professionalsError);

        if (!professionalsError && linkedProfessionals) {
          professionalsData = linkedProfessionals
            .map(link => link.profiles)
            .filter(prof => prof !== null);
        } else if (professionalsError) {
          console.error('Erro ao buscar profissionais vinculados:', professionalsError);
        }
      }

      // Buscar registros diários recentes
      const { data: records, error: recordsError } = await supabase
        .from('daily_records')
        .select('*')
        .eq('patient_id', patientRecord?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recordsError) {
        console.error('Erro ao buscar registros recentes:', recordsError);
      }

      // Buscar solicitações de link pendentes
      const { data: requests, error: requestsError } = await supabase
        .from('link_requests')
        .select(`
          *,
          requester_profile:profiles!link_requests_requester_id_fkey(nome, codigo, especialidade)
        `)
        .eq('target_id', profile?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Erro ao buscar solicitações de link:', requestsError);
      }

      setPatientData({
        professionals: professionalsData,
        recentRecords: records || [],
        linkRequests: requests || []
      });

      console.log('Profissionais vinculados:', professionalsData);

    } catch (error) {
      console.error('Erro ao buscar dados do paciente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        Carregando...
      </div>
    );
  }

  if (isProfessional) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="flex h-14 items-center justify-between px-6">
            <div className="flex items-center">
              <SidebarTrigger />
              <div className="ml-4">
                <h2 className="font-semibold text-foreground">Dashboard</h2>
                <p className="text-xs text-muted-foreground">
                  Bem-vindo, {profile?.nome}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LinkRequestsNotifications />
              <LinkPatientDialog />
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Card de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Pacientes Totais
                </CardTitle>
                <CardDescription>Número total de pacientes vinculados</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dashboardData?.totalPatients || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Taxa de Resposta
                </CardTitle>
                <CardDescription>Taxa de resposta dos pacientes aos registros</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dashboardData?.responseRate || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Registros de Hoje
                </CardTitle>
                <CardDescription>Número de registros preenchidos hoje</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dashboardData?.todayRecords || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Card de Alertas Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Alertas Clínicos Recentes
              </CardTitle>
              <CardDescription>Alertas gerados pelos registros dos pacientes</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{alert.patient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Gerado em {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/alertas')}>
                        Ver Detalhes
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhum alerta recente
                  </h3>
                  <p className="text-muted-foreground">
                    Seus pacientes estão estáveis no momento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Pacientes Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Pacientes Recentes
              </CardTitle>
              <CardDescription>Pacientes que se vincularam recentemente</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentPatients.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recentPatients.map((patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            Vinculado em {format(new Date(patient.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/pacientes', { state: { selectedPatientId: patient.id } })}
                      >
                        Ver Perfil
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhum paciente recente
                  </h3>
                  <p className="text-muted-foreground">
                    Compartilhe seu código para atrair novos pacientes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Dashboard do Paciente
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Dashboard</h2>
              <p className="text-xs text-muted-foreground">
                Bem-vindo, {profile?.nome}
              </p>
            </div>
          </div>
          <LinkRequestsNotifications />
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Card dos Profissionais Vinculados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Profissionais Vinculados
            </CardTitle>
            <CardDescription>
              Profissionais de saúde que acompanham seu tratamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {patientData?.professionals && patientData.professionals.length > 0 ? (
              <div className="space-y-3">
                {patientData.professionals.map((professional, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedProfessional(professional);
                      setShowProfessionalDialog(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{professional.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {professional.especialidade || 'Profissional de Saúde'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Código: {professional.codigo}
                        </p>
                      </div>
                    </div>
                    <Badge variant={professional.is_medico ? "default" : "secondary"}>
                      {professional.is_medico ? "Médico" : "Psicólogo"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum profissional vinculado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Você ainda não possui profissionais vinculados ao seu tratamento.
                </p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com seu profissional de saúde para solicitar a vinculação.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Registros Diários Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Registros Diários Recentes
            </CardTitle>
            <CardDescription>Seu histórico de registros diários</CardDescription>
          </CardHeader>
          <CardContent>
            {patientData?.recentRecords.length > 0 ? (
              <div className="space-y-3">
                {patientData.recentRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {format(new Date(record.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Humor: {record.humor}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Ver Detalhes
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum registro diário recente
                </h3>
                <p className="text-muted-foreground">
                  Preencha seu registro diário para acompanhar sua evolução.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Professional Profile Dialog */}
      <ProfessionalProfileDialog
        professional={selectedProfessional}
        open={showProfessionalDialog}
        onOpenChange={setShowProfessionalDialog}
      />
    </div>
  );
};

export default Index;
