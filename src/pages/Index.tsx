import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, TrendingUp, Users, Calendar, AlertTriangle, Heart, Brain, ChevronRight, User, UserCheck, Link2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LinkPatientDialog } from '@/components/LinkPatientDialog';
import { LinkRequestsNotifications } from '@/components/LinkRequestsNotifications';
import { ProfessionalProfileDialog } from '@/components/ProfessionalProfileDialog';
import { fetchDashboard, DashboardResponse } from '@/lib/apiClient';

const Index = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [dashboardData, setDashboardData] = useState<DashboardResponse['dashboard'] | null>(null);
  const [patientData, setPatientData] = useState<DashboardResponse['patientData'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
  const [showProfessionalDialog, setShowProfessionalDialog] = useState(false);

  const isProfessional = profile?.tipo === 'profissional';

  useEffect(() => {
    if (!profile) return;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const data = await fetchDashboard(isProfessional ? 'profissional' : 'paciente');
        setDashboardData(data.dashboard);
        setPatientData(data.patientData || null);
      } catch (error) {
        console.error('Erro ao carregar dashboard', error);
        toast({
          title: 'Erro ao carregar dashboard',
          description: 'Confirme se o backend FastAPI está em execução em http://localhost:8000.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [profile, toast, isProfessional]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bem-vindo(a), {profile?.nome || 'Usuário'}</h1>
            <p className="text-muted-foreground">
              {isProfessional
                ? 'Acompanhe o desempenho e os alertas clínicos dos pacientes.'
                : 'Veja sua evolução diária e mantenha contato com sua equipe.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isProfessional ? <LinkRequestsNotifications /> : <LinkPatientDialog />}
          <Button variant="outline" onClick={() => navigate('/calendario')}>
            Ver calendário
            <Calendar className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <CardTitle className="h-4 bg-muted rounded w-1/3" />
                <CardDescription className="h-3 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Alertas Clínicos Recentes
              </CardTitle>
              <CardDescription>Alertas gerados pelos registros dos pacientes</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentAlerts?.length ? (
                <div className="space-y-3">
                  {dashboardData.recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Alerta #{alert.id}</p>
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
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum alerta recente</h3>
                  <p className="text-muted-foreground">Seus pacientes estão estáveis no momento.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Pacientes Recentes
              </CardTitle>
              <CardDescription>Pacientes que se vincularam recentemente</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentPatients?.length ? (
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
                      <Button variant="outline" size="sm" onClick={() => navigate('/pacientes')}>
                        Ver Perfil
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum paciente recente</h3>
                  <p className="text-muted-foreground">Compartilhe seu código para atrair novos pacientes.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!isProfessional && patientData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    Equipe de cuidado
                  </CardTitle>
                  <CardDescription>Profissionais vinculados ao seu acompanhamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {patientData.professionals.length ? (
                    patientData.professionals.map((professional) => (
                      <div key={professional.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Heart className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{professional.nome}</p>
                            <p className="text-sm text-muted-foreground">{professional.especialidade || 'Profissional de saúde'}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedProfessional(professional); setShowProfessionalDialog(true); }}>
                          Ver detalhes
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhum profissional vinculado ainda.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Registros recentes
                  </CardTitle>
                  <CardDescription>Acompanhamento dos seus últimos registros</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {patientData.recentRecords.length ? (
                    patientData.recentRecords.map((record) => (
                      <div key={record.id} className="p-3 border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium">Registro em {format(new Date(record.data), 'dd/MM/yyyy', { locale: ptBR })}</p>
                          <div className="flex gap-3 text-sm text-muted-foreground">
                            <span>Humor: {record.mood}</span>
                            <span>Energia: {record.energy}</span>
                            <span>Sono: {record.sleep}h</span>
                          </div>
                        </div>
                        <Badge variant="secondary">Adesão: {record.medication_adherence * 100}%</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhum registro encontrado.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Solicitações de vínculo
                  </CardTitle>
                  <CardDescription>Convites para se conectar com profissionais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {patientData.linkRequests.length ? (
                    patientData.linkRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Solicitação #{request.id}</p>
                          <p className="text-sm text-muted-foreground">Enviada em {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        </div>
                        <Badge variant="outline">{request.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Link2 className="h-4 w-4" />
                      <span>Nenhuma solicitação pendente</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <ProfessionalProfileDialog
                open={showProfessionalDialog}
                onOpenChange={setShowProfessionalDialog}
                professional={selectedProfessional}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Index;
