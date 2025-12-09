import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pill, Clock, User, Eye, CheckCircle, XCircle, Calendar, Trash2, MoreVertical, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MedicationDeleteDialog from '@/components/MedicationDeleteDialog';
import MedicationScheduleTracker from '@/components/MedicationScheduleTracker';
import MedicationTracker from '@/components/MedicationTracker';
import PatientsMedicationOverview from '@/components/PatientsMedicationOverview';

// Tipos para medicamentos
interface Medication {
  id: string;
  patient_id: string;
  nome_medicamento: string;
  dosagem: string;
  frequencia: number;
  horarios: string[];
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  prescrito_por: string;
  ativo: boolean;
  created_at: string;
  // Relacionamentos
  patient?: { nome: string };
  prescriber?: { nome: string };
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  patient_id: string;
  data_horario: string;
  tomado: boolean;
  observacoes: string | null;
  created_at: string;
}

const Medicamentos = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [selectedPatientForView, setSelectedPatientForView] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    medicationId: string;
    medicationName: string;
  }>({ isOpen: false, medicationId: '', medicationName: '' });

  // Estados do formulário
  const [formData, setFormData] = useState({
    nome_medicamento: '',
    dosagem: '',
    frequencia: 1,
    horarios: ['08:00'],
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    observacoes: ''
  });

  const isPsychiatrist = profile?.tipo === 'profissional' && profile?.especialidade?.toLowerCase().includes('psiquiatria');
  const isProfessional = profile?.tipo === 'profissional';
  const isPatient = profile?.tipo === 'paciente';

  useEffect(() => {
    if (isProfessional) {
      fetchPatients();
    } else {
      fetchMedications();
    }
  }, []);

  useEffect(() => {
    if (isProfessional && selectedPatientForView) {
      fetchMedications();
    }
  }, [selectedPatientForView]);

  const fetchMedications = async () => {
    try {
      if (isPatient) {
        // Paciente vê apenas seus medicamentos
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', profile?.user_id)
          .single();

        if (!patient) {
          setMedications([]);
          setLoading(false);
          return;
        }

        const { data: medicationsData, error } = await supabase
          .from('medications')
          .select('*')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Buscar prescritores separadamente
        let medicationsWithPrescribers = [];
        if (medicationsData && medicationsData.length > 0) {
          const prescriberIds = [...new Set(medicationsData.map(m => m.prescrito_por))];
          const { data: prescribersData } = await supabase
            .from('profiles')
            .select('id, nome')
            .in('id', prescriberIds);

          medicationsWithPrescribers = medicationsData.map(medication => ({
            ...medication,
            prescriber: prescribersData?.find(p => p.id === medication.prescrito_por)
          }));
        }

        setMedications(medicationsWithPrescribers || []);
      } else if (isProfessional) {
        // Profissional vê medicamentos do paciente selecionado
        if (!selectedPatientForView) {
          setMedications([]);
          setLoading(false);
          return;
        }

        const { data: medicationsData, error } = await supabase
          .from('medications')
          .select('*')
          .eq('patient_id', selectedPatientForView)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Buscar dados do paciente
        const { data: patientData } = await supabase
          .from('patients')
          .select('user_id')
          .eq('id', selectedPatientForView)
          .single();

        let patientName = 'Nome não encontrado';
        if (patientData) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nome')
            .eq('user_id', patientData.user_id)
            .single();
          
          if (profileData) {
            patientName = profileData.nome;
          }
        }
        
        const formattedMedications = medicationsData?.map((med: any) => ({
          ...med,
          patient: { nome: patientName }
        })) || [];
        
        setMedications(formattedMedications);
      }
    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os medicamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      if (!profile?.id) {
        console.log('Profile ID não encontrado');
        return;
      }

      console.log('Buscando pacientes para profissional:', profile.id);
      
      // Buscar pacientes vinculados através da nova estrutura
      const { data: linkedPatients, error } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients(
            id,
            user_id
          )
        `)
        .eq('professional_id', profile.id)
        .eq('status', 'active');

      if (error) {
        console.error('Erro ao buscar pacientes:', error);
        return;
      }

      console.log('Pacientes encontrados:', linkedPatients);

      let formattedPatients = [];
      if (linkedPatients && linkedPatients.length > 0) {
        const userIds = linkedPatients
          .map(link => link.patients?.user_id)
          .filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('nome, user_id')
            .in('user_id', userIds);

          formattedPatients = linkedPatients.map(link => {
            if (!link.patients) return null;
            const profile = profilesData?.find(p => p.user_id === link.patients?.user_id);
            return profile ? {
              id: link.patients.id,
              nome: profile.nome
            } : null;
          }).filter(Boolean);
        }
      }

      setPatients(formattedPatients);
      
      // Selecionar primeiro paciente automaticamente
      if (formattedPatients.length > 0 && !selectedPatientForView) {
        setSelectedPatientForView(formattedPatients[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar pacientes:', error);
    }
  };

  const handleFrequencyChange = (freq: number) => {
    const newHorarios = [];
    const intervalHours = Math.floor(24 / freq);
    
    for (let i = 0; i < freq; i++) {
      const hour = (8 + (i * intervalHours)) % 24;
      newHorarios.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    setFormData({ ...formData, frequencia: freq, horarios: newHorarios });
  };

  const handleAddMedication = async () => {
    // Verificar se o profissional pode prescrever medicamentos
    if (!profile?.is_medico && !profile?.codigo?.startsWith('PM')) {
      toast({
        title: "Acesso negado",
        description: "Apenas médicos podem prescrever medicamentos",
        variant: "destructive"
      });
      return;
    }

    if (!isProfessional) {
      toast({
        title: "Acesso negado",
        description: "Apenas profissionais podem prescrever medicamentos.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPatient) {
      toast({
        title: "Erro",
        description: "Selecione um paciente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          patient_id: selectedPatient,
          prescrito_por: profile?.id,
          nome_medicamento: formData.nome_medicamento,
          dosagem: formData.dosagem,
          frequencia: formData.frequencia,
          horarios: formData.horarios,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || null,
          observacoes: formData.observacoes || null,
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Medicamento adicionado com sucesso.",
      });

      setShowAddDialog(false);
      setFormData({
        nome_medicamento: '',
        dosagem: '',
        frequencia: 1,
        horarios: ['08:00'],
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        data_fim: '',
        observacoes: ''
      });
      setSelectedPatient('');
      fetchMedications();
    } catch (error) {
      console.error('Erro ao adicionar medicamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o medicamento.",
        variant: "destructive",
      });
    }
  };

  const toggleMedicationStatus = async (medicationId: string, currentStatus: boolean) => {
    if (!isProfessional) {
      toast({
        title: "Acesso negado",
        description: "Apenas profissionais podem alterar medicamentos.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('medications')
        .update({ ativo: !currentStatus })
        .eq('id', medicationId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Medicamento ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });

      fetchMedications();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do medicamento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMedication = () => {
    fetchMedications();
    setDeleteDialog({ isOpen: false, medicationId: '', medicationName: '' });
  };

  const openDeleteDialog = (medicationId: string, medicationName: string) => {
    setDeleteDialog({ isOpen: true, medicationId, medicationName });
  };

  const PatientMedicationView = ({ medication }: { medication: Medication }) => (
    <Card key={medication.id} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{medication.nome_medicamento}</CardTitle>
          </div>
          <Badge variant={medication.ativo ? "default" : "secondary"}>
            {medication.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <CardDescription>
          Prescrito por: {medication.prescriber?.nome || 'Prescritor não encontrado'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Dosagem</p>
            <p className="text-sm text-muted-foreground">{medication.dosagem}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Frequência</p>
            <p className="text-sm text-muted-foreground">{medication.frequencia}x ao dia</p>
          </div>
          <div>
            <p className="text-sm font-medium">Horários</p>
            <div className="flex gap-1 flex-wrap">
              {medication.horarios.map((horario, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {horario}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Início do Tratamento</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(medication.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>
        {medication.observacoes && (
          <div className="mt-4">
            <p className="text-sm font-medium">Observações</p>
            <p className="text-sm text-muted-foreground">{medication.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const ProfessionalMedicationView = ({ medication }: { medication: Medication }) => (
    <Card key={medication.id} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{medication.nome_medicamento}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {medication.patient?.nome}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={medication.ativo ? "default" : "secondary"}>
              {medication.ativo ? "Ativo" : "Inativo"}
            </Badge>
            {isProfessional && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => openDeleteDialog(medication.id, medication.nome_medicamento)}
                    className="text-health-danger"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir/Desprescrever
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium">Dosagem</p>
            <p className="text-sm text-muted-foreground">{medication.dosagem}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Frequência</p>
            <p className="text-sm text-muted-foreground">{medication.frequencia}x ao dia</p>
          </div>
          <div>
            <p className="text-sm font-medium">Horários</p>
            <div className="flex gap-1 flex-wrap">
              {medication.horarios.map((horario, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {horario}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {medication.observacoes && (
          <div className="mt-4">
            <p className="text-sm font-medium">Observações</p>
            <p className="text-sm text-muted-foreground">{medication.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Medicamentos</h2>
            </div>
          </div>
        </header>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-14 items-center px-6 justify-between">
          <div className="flex items-center">
            <SidebarTrigger />
            <div className="ml-4 flex-1">
              <h2 className="font-semibold text-foreground">Medicamentos</h2>
              {isProfessional && selectedPatientForView && (
                <p className="text-xs text-muted-foreground">
                  Paciente: {patients.find(p => p.id === selectedPatientForView)?.nome}
                </p>
              )}
            </div>
          </div>
          
          {/* Seletor de Paciente para Profissionais */}
          {isProfessional && patients.length > 0 && (
            <div className="mr-4">
              <select
                value={selectedPatientForView}
                onChange={(e) => setSelectedPatientForView(e.target.value)}
                className="text-sm border rounded-md px-3 py-1 bg-background border-border text-foreground shadow-lg z-50 min-w-[200px]"
              >
                <option value="">Selecione um paciente</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isProfessional && (profile?.is_medico || profile?.codigo?.startsWith('PM')) && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Prescrever Medicamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Prescrever Novo Medicamento</DialogTitle>
                  <DialogDescription>
                    Adicione um novo medicamento para o paciente
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient">Paciente</Label>
                    <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Medicamento</Label>
                      <Input
                        id="nome"
                        value={formData.nome_medicamento}
                        onChange={(e) => setFormData({ ...formData, nome_medicamento: e.target.value })}
                        placeholder="Ex: Sertralina"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dosagem">Dosagem</Label>
                      <Input
                        id="dosagem"
                        value={formData.dosagem}
                        onChange={(e) => setFormData({ ...formData, dosagem: e.target.value })}
                        placeholder="Ex: 50mg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequencia">Frequência por dia</Label>
                    <Select 
                      value={formData.frequencia.toString()} 
                      onValueChange={(value) => handleFrequencyChange(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1x ao dia</SelectItem>
                        <SelectItem value="2">2x ao dia</SelectItem>
                        <SelectItem value="3">3x ao dia</SelectItem>
                        <SelectItem value="4">4x ao dia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horários</Label>
                    <div className="flex gap-2 flex-wrap">
                      {formData.horarios.map((horario, index) => (
                        <Input
                          key={index}
                          type="time"
                          value={horario}
                          onChange={(e) => {
                            const newHorarios = [...formData.horarios];
                            newHorarios[index] = e.target.value;
                            setFormData({ ...formData, horarios: newHorarios });
                          }}
                          className="w-32"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data_inicio">Data de Início</Label>
                      <Input
                        id="data_inicio"
                        type="date"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_fim">Data de Fim (Opcional)</Label>
                      <Input
                        id="data_fim"
                        type="date"
                        value={formData.data_fim}
                        onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (Opcional)</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Instruções especiais, efeitos esperados, etc."
                    />
                  </div>

                  <Button 
                    onClick={handleAddMedication} 
                    className="w-full"
                    disabled={!selectedPatient || !formData.nome_medicamento || !formData.dosagem}
                  >
                    Prescrever Medicamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="p-6">
        {isPatient && (
          <div className="mb-8">
            <MedicationScheduleTracker />
          </div>
        )}

        {isProfessional && (
          <div className="mb-8">
            <PatientsMedicationOverview 
              professionalId={profile.id}
              selectedPatientId={selectedPatientForView}
              onPatientSelect={setSelectedPatientForView}
            />
          </div>
        )}

        {medications.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {isPatient ? 'Nenhum medicamento prescrito' : 'Nenhum medicamento encontrado'}
                </h3>
                <p className="text-muted-foreground">
                  {isPatient 
                    ? 'Você ainda não possui medicamentos prescritos pelo seu psiquiatra.'
                    : isPsychiatrist
                    ? 'Prescreva medicamentos para seus pacientes para começar o acompanhamento.'
                    : 'Nenhum medicamento foi encontrado para seus pacientes.'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Tracking individual para profissionais */}
            {isProfessional && selectedPatientForView && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Acompanhamento de Medicação - Hoje</h3>
                <MedicationTracker patientId={selectedPatientForView} isViewOnly={true} />
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {isPatient ? 'Medicamentos Prescritos' : 'Medicamentos do Paciente'}
                </h3>
                <Badge variant="outline">
                  {medications.filter(m => m.ativo).length} ativos
                </Badge>
              </div>
              
              {medications.map((medication) => 
                isPatient ? (
                  <PatientMedicationView key={medication.id} medication={medication} />
                ) : (
                  <ProfessionalMedicationView key={medication.id} medication={medication} />
                )
              )}
            </div>
          </div>
        )}

        <MedicationDeleteDialog
          isOpen={deleteDialog.isOpen}
          onClose={() => setDeleteDialog({ isOpen: false, medicationId: '', medicationName: '' })}
          medicationId={deleteDialog.medicationId}
          medicationName={deleteDialog.medicationName}
          onDelete={handleDeleteMedication}
        />
      </div>
    </div>
  );
};

export default Medicamentos;
