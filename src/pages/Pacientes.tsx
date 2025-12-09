import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Mail, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Plus,
  Search,
  Calendar,
  Pill,
  Clock,
  Edit3,
  CheckCircle,
  Eye,
  Menu
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MedicationTracker from '@/components/MedicationTracker';
import { PatientQuestionnaireSettings } from '@/components/PatientQuestionnaireSettings';
import { InternalComments } from '@/components/InternalComments';
import { QuestionnaireResults } from '@/components/QuestionnaireResults';
import { PatientSummaries } from '@/components/PatientSummaries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PatientAnalytics from '@/components/PatientAnalytics';

interface Patient {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  created_at: string;
  last_record?: {
    mood_level: number;
    created_at: string;
  };
  alerts_count: number;
}

interface PatientRecord {
  id: string;
  patient_id: string;
  como_se_sentiu: string | null;
  data: string;
  gatilhos: string | null;
  humor: string;
  observacoes_profissional: string | null;
  sinal_alerta: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Medication {
  id: string;
  nome_medicamento: string;
  dosagem: string;
  frequencia: number;
  horarios: string[];
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
}

const Pacientes = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientRecords, setPatientRecords] = useState<PatientRecord[]>([]);
  const [patientMedications, setPatientMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [medicationStatus, setMedicationStatus] = useState<{[key: string]: number}>({});
  const [currentTab, setCurrentTab] = useState('overview');

  useEffect(() => {
    if (profile?.tipo === 'profissional') {
      fetchPatients();
    }
  }, [profile]);

  useEffect(() => {
    if (patients.length > 0) {
      fetchMedicationStatus();
    }
  }, [patients]);

  // Handle patient selection from navigation state
  useEffect(() => {
    if (location.state?.selectedPatientId && patients.length > 0) {
      const patient = patients.find(p => p.id === location.state.selectedPatientId);
      if (patient) {
        handlePatientClick(patient);
      }
    }
  }, [location.state, patients]);

  const fetchPatients = async () => {
    try {
      console.log('Buscando pacientes para o profissional:', profile?.id);
      
      // Buscar pacientes vinculados através da nova estrutura
      const { data: linkedPatients, error: patientsError } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          status,
          patients(
            id,
            user_id,
            created_at
          )
        `)
        .eq('professional_id', profile?.id)
        .eq('status', 'active');

      if (patientsError) throw patientsError;

      // Buscar os perfis dos pacientes separadamente
      if (linkedPatients && linkedPatients.length > 0) {
        const userIds = linkedPatients
          .map(link => link.patients?.user_id)
          .filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nome, email, telefone, created_at, user_id')
            .in('user_id', userIds);

          if (profilesError) {
            console.error('Erro ao buscar perfis:', profilesError);
            throw profilesError;
          }

          // Combinar dados
          const patientsWithProfiles = linkedPatients.map(link => {
            if (!link.patients) return null;
            return {
              ...link.patients,
              profiles: profilesData?.find(profile => profile.user_id === link.patients?.user_id)
            };
          }).filter(Boolean);

          console.log('Pacientes com perfis:', patientsWithProfiles);

          // Para cada paciente, buscar último registro e contar alertas
          const patientsWithData = await Promise.all(
            patientsWithProfiles.map(async (patientRecord) => {
              if (!patientRecord?.profiles) return null;

              const patientProfile = patientRecord.profiles;

              // Buscar último registro
              const { data: lastRecord } = await supabase
                .from('daily_records')
                .select('humor, created_at')
                .eq('patient_id', patientRecord.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              // Contar alertas ativos
              const { count: alertsCount } = await supabase
                .from('clinical_alerts')
                .select('*', { count: 'exact' })
                .eq('profissional_id', profile?.id)
                .eq('visualizado', false);

              return {
                id: patientRecord.id,
                nome: patientProfile.nome,
                email: patientProfile.email,
                telefone: patientProfile.telefone,
                created_at: patientProfile.created_at,
                last_record: lastRecord ? {
                  mood_level: parseInt(lastRecord.humor),
                  created_at: lastRecord.created_at
                } : undefined,
                alerts_count: alertsCount || 0
              };
            })
          );

          setPatients(patientsWithData.filter(Boolean) as Patient[]);
        }
      } else {
        setPatients([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar pacientes",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicationStatus = async () => {
    try {
      const statusMap: {[key: string]: number} = {};
      
      for (const patient of patients) {
        // Buscar medicamentos ativos do paciente
        const { data: medications } = await supabase
          .from('medications')
          .select('id, horarios')
          .eq('patient_id', patient.id)
          .eq('ativo', true);

        if (!medications || medications.length === 0) {
          statusMap[patient.id] = 0;
          continue;
        }

        // Buscar tomadas de hoje
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const { data: intakes } = await supabase
          .from('medication_intakes')
          .select('*')
          .eq('patient_id', patient.id)
          .gte('data_horario', startOfDay.toISOString())
          .lte('data_horario', endOfDay.toISOString())
          .eq('tomado', true);

        const totalScheduled = medications.reduce((total, med) => total + med.horarios.length, 0);
        const totalTaken = intakes?.length || 0;
        const adherence = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;
        
        statusMap[patient.id] = adherence;
      }
      
      setMedicationStatus(statusMap);
    } catch (error) {
      console.error('Erro ao buscar status dos medicamentos:', error);
    }
  };

  const handleInvitePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !inviteCode) return;

    try {
      console.log('Procurando paciente com código:', inviteCode);
      
      // Usar a função RPC para buscar paciente por código
      const { data: userData, error: userError } = await supabase
        .rpc('find_patient_by_code', { patient_code: inviteCode });

      console.log('Dados do paciente encontrado:', userData);
      console.log('Erro na busca do paciente:', userError);

      if (userError || !userData || userData.length === 0) {
        toast({
          title: "Paciente não encontrado",
          description: "Não foi encontrado um paciente com este código. Verifique se o código está correto.",
          variant: "destructive"
        });
        return;
      }

      const patientData = userData[0];

      // Verificar se já existe uma solicitação pendente
      const { data: existingRequest, error: requestError } = await supabase
        .from('link_requests')
        .select('id')
        .eq('requester_id', profile.id)
        .eq('target_id', patientData.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (requestError) {
        console.error('Erro ao verificar solicitações existentes:', requestError);
      }

      if (existingRequest) {
        toast({
          title: "Solicitação já enviada",
          description: "Você já enviou uma solicitação para este paciente.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se o paciente já está vinculado
      const { data: existingPatient, error: searchError } = await supabase
        .from('patients')
        .select('id, profissional_id')
        .eq('user_id', patientData.user_id)
        .maybeSingle();

      if (existingPatient && existingPatient.profissional_id === profile.id) {
        toast({
          title: "Paciente já vinculado",
          description: "Este paciente já está vinculado a você.",
          variant: "destructive"
        });
        return;
      }

      // Enviar solicitação de vinculação
      const { error: insertError } = await supabase
        .from('link_requests')
        .insert({
          requester_id: profile.id,
          target_id: patientData.id,
          requester_type: 'profissional',
          target_type: 'paciente',
          message: `Olá! Sou ${profile.nome} e gostaria de acompanhar seu tratamento.`
        });

      if (insertError) {
        console.error('Erro ao enviar solicitação:', insertError);
        throw insertError;
      }

      toast({
        title: "Solicitação enviada!",
        description: `Solicitação de vinculação enviada para ${patientData.nome}`,
        variant: "default"
      });

      setInviteCode('');
      setShowInviteForm(false);
    } catch (error: any) {
      console.error('Erro detalhado ao enviar solicitação:', error);
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  const fetchPatientRecords = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPatientRecords(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar registros",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchPatientMedications = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientMedications(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar medicamentos",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    fetchPatientRecords(patient.id);
    fetchPatientMedications(patient.id);
  };

  const getMoodTrend = (records: PatientRecord[]) => {
    if (records.length < 2) return null;
    const recent = parseInt(records[0].humor);
    const previous = parseInt(records[1].humor);
    
    if (recent > previous) return { type: 'up', color: 'text-health-success' };
    if (recent < previous) return { type: 'down', color: 'text-health-danger' };
    return { type: 'stable', color: 'text-muted-foreground' };
  };

  const filteredPatients = patients.filter(patient =>
    patient.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Meus Pacientes</h2>
            </div>
          </div>
        </header>
        <div className="p-6 text-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <SidebarTrigger />
          <div className="ml-4 flex-1">
            <h2 className="font-semibold text-foreground">Meus Pacientes</h2>
          </div>
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Vincular Paciente
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-6 max-w-7xl">
        {showInviteForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Vincular Novo Paciente</CardTitle>
              <CardDescription>
                Digite o código do paciente que deseja vincular (ex: PC000001)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvitePatient} className="flex gap-2 max-w-md">
                <Input
                  type="text"
                  placeholder="PC000001"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  pattern="[A-Z]{2}[0-9]{6}"
                  required
                />
                <Button type="submit">Vincular</Button>
                <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
                  Cancelar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!selectedPatient ? (
          // Lista de Pacientes sem paciente selecionado
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar pacientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredPatients.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Nenhum paciente encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Tente ajustar sua busca' : 'Vincule pacientes para começar a acompanhar seus tratamentos'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowInviteForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Vincular Primeiro Paciente
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPatients.map((patient) => (
                  <Card 
                    key={patient.id} 
                    className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                    onClick={() => handlePatientClick(patient)}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-lg">{patient.nome}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              {patient.email}
                            </div>
                          </div>
                          {patient.alerts_count > 0 && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {patient.alerts_count}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Último Registro</span>
                            <div className="text-sm font-medium">
                              {patient.last_record 
                                ? format(new Date(patient.last_record.created_at), 'dd/MM/yyyy')
                                : 'Nenhum registro'
                              }
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Aderência</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{medicationStatus[patient.id] || 0}%</span>
                              {medicationStatus[patient.id] >= 80 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : medicationStatus[patient.id] >= 60 ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                        </div>

                        {patient.last_record && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Humor</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{patient.last_record.mood_level}/10</span>
                              <div className="w-16 bg-secondary rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${(patient.last_record.mood_level / 10) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Layout com paciente selecionado - vista detalhada
          <div className="space-y-6">
            {/* Cabeçalho do paciente selecionado */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                  ← Voltar para lista
                </Button>
                <div>
                  <h3 className="text-2xl font-bold">{selectedPatient.nome}</h3>
                  <p className="text-muted-foreground">{selectedPatient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {selectedPatient.alerts_count > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {selectedPatient.alerts_count} alerta{selectedPatient.alerts_count > 1 ? 's' : ''}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Cadastrado em {format(new Date(selectedPatient.created_at), 'dd/MM/yyyy')}
                </span>
              </div>
            </div>

            {/* Tabs principais */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                  {/* Seletor para mobile */}
                  <div className="md:hidden mb-4">
                    <Select value={currentTab} onValueChange={setCurrentTab}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {currentTab === 'overview' && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Registros Diários</span>
                            </div>
                          )}
                          {currentTab === 'medications' && (
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              <span>Medicamentos</span>
                            </div>
                          )}
                          {currentTab === 'analytics' && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              <span>Analytics</span>
                            </div>
                          )}
                          {currentTab === 'questionnaires' && (
                            <div className="flex items-center gap-2">
                              <Edit3 className="h-4 w-4" />
                              <span>Questionários</span>
                            </div>
                          )}
                          {currentTab === 'results' && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              <span>Resultados</span>
                            </div>
                          )}
                          {currentTab === 'summaries' && (
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              <span>Resumos IA</span>
                            </div>
                          )}
                          {currentTab === 'internal-notes' && (
                            <div className="flex items-center gap-2">
                              <Edit3 className="h-4 w-4" />
                              <span>Notas Internas</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        <SelectItem value="overview">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Registros Diários</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medications">
                          <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4" />
                            <span>Medicamentos</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="analytics">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            <span>Analytics</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="questionnaires">
                          <div className="flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            <span>Questionários</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="results">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            <span>Resultados</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="summaries">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span>Resumos IA</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="internal-notes">
                          <div className="flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            <span>Notas Internas</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Tabs para desktop com scroll horizontal */}
                  <div className="hidden md:block border-b overflow-x-auto">
                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent inline-flex min-w-full">
                      <TabsTrigger value="overview" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <Calendar className="h-4 w-4 mr-2" />
                        Registros Diários
                      </TabsTrigger>
                      <TabsTrigger value="medications" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <Pill className="h-4 w-4 mr-2" />
                        Medicamentos
                      </TabsTrigger>
                      <TabsTrigger value="analytics" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Analytics
                      </TabsTrigger>
                      <TabsTrigger value="questionnaires" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Questionários
                      </TabsTrigger>
                      <TabsTrigger value="results" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Resultados
                      </TabsTrigger>
                      <TabsTrigger value="summaries" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <Eye className="h-4 w-4 mr-2" />
                        Resumos IA
                      </TabsTrigger>
                      <TabsTrigger value="internal-notes" className="px-4 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Notas Internas
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <div className="mt-6">
                    <TabsContent value="overview" className="mt-0">
                      {patientRecords.length === 0 ? (
                        <div className="text-center py-12">
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h4 className="text-lg font-medium mb-2">Nenhum registro encontrado</h4>
                          <p className="text-muted-foreground">Este paciente ainda não criou registros diários.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {patientRecords.slice(0, 9).map((record, index) => {
                            const isRecent = index === 0;
                            const trend = index === 0 ? getMoodTrend(patientRecords) : null;
                            
                            return (
                              <Card key={record.id} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div className="text-sm text-muted-foreground">
                                      {format(new Date(record.created_at), 'dd/MM/yyyy - HH:mm')}
                                    </div>
                                    {isRecent && trend && (
                                      <div className={`flex items-center gap-1 ${trend.color}`}>
                                        {trend.type === 'up' && <TrendingUp className="h-4 w-4" />}
                                        {trend.type === 'down' && <TrendingDown className="h-4 w-4" />}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-muted-foreground">Humor</span>
                                      <span className="font-semibold text-lg">{record.humor}/10</span>
                                    </div>
                                    
                                    {record.sinal_alerta && (
                                      <div className="flex items-center gap-2 text-health-danger font-medium text-sm">
                                        <AlertTriangle className="h-4 w-4" />
                                        Sinal de Alerta
                                      </div>
                                    )}
                                  </div>
                                  
                                  {record.como_se_sentiu && (
                                    <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                      {record.como_se_sentiu.length > 100 
                                        ? `${record.como_se_sentiu.substring(0, 100)}...`
                                        : record.como_se_sentiu
                                      }
                                    </div>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="medications" className="mt-0">
                      <MedicationTracker 
                        patientId={selectedPatient.id} 
                        isViewOnly={true}
                      />
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-0">
                      <PatientAnalytics 
                        patientId={selectedPatient.id}
                        patientName={selectedPatient.nome}
                      />
                    </TabsContent>

                    <TabsContent value="questionnaires" className="mt-0">
                      {profile?.id && (
                        <PatientQuestionnaireSettings 
                          patientId={selectedPatient.id}
                          professionalId={profile.id}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="results" className="mt-0">
                      <QuestionnaireResults patientId={selectedPatient.id} />
                    </TabsContent>

                    <TabsContent value="summaries" className="mt-0">
                      <PatientSummaries patientId={selectedPatient.id} />
                    </TabsContent>

                    <TabsContent value="internal-notes" className="mt-0">
                      <InternalComments patientId={selectedPatient.id} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pacientes;