import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, Check, Pill, AlertCircle, CheckCircle, Trash2, MoreVertical } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MedicationDeleteDialog from './MedicationDeleteDialog';

interface Medication {
  id: string;
  nome_medicamento: string;
  dosagem: string;
  frequencia: number;
  horarios: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  prescriber?: { nome: string };
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  data_horario: string;
  tomado: boolean;
  observacoes: string | null;
}

const PatientMedicationView: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    medicationId: string;
    medicationName: string;
  }>({ isOpen: false, medicationId: '', medicationName: '' });

  useEffect(() => {
    if (profile?.tipo === 'paciente') {
      fetchPatientData();
    }
  }, [profile]);

  const fetchPatientData = async () => {
    try {
      // Buscar ID do paciente
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile?.user_id)
        .single();

      if (patient) {
        setPatientId(patient.id);
        await Promise.all([
          fetchMedications(patient.id),
          fetchTodayIntakes(patient.id)
        ]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do paciente:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async (patientId: string) => {
    try {
      const { data: medicationsData, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar os prescritores separadamente
      let medicationsWithPrescribers = [];
      if (medicationsData && medicationsData.length > 0) {
        const prescriberIds = [...new Set(medicationsData.map(m => m.prescrito_por))];
        const { data: prescribersData, error: prescribersError } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', prescriberIds);

        if (prescribersError) {
          console.error('Erro ao buscar prescritores:', prescribersError);
          medicationsWithPrescribers = medicationsData;
        } else {
          medicationsWithPrescribers = medicationsData.map(medication => ({
            ...medication,
            prescriber: prescribersData?.find(p => p.id === medication.prescrito_por)
          }));
        }
      }

      setMedications(medicationsWithPrescribers || []);

    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os medicamentos.",
        variant: "destructive",
      });
    }
  };

  const fetchTodayIntakes = async (patientId: string) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const { data, error } = await supabase
        .from('medication_intakes')
        .select('*')
        .eq('patient_id', patientId)
        .gte('data_horario', startOfDay.toISOString())
        .lte('data_horario', endOfDay.toISOString());

      if (error) throw error;
      setIntakes(data || []);
    } catch (error) {
      console.error('Erro ao buscar tomadas:', error);
    }
  };

  const markMedicationTaken = async (medicationId: string, horario: string, taken: boolean) => {
    try {
      const today = new Date();
      const [hours, minutes] = horario.split(':');
      const scheduleTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
        parseInt(hours), parseInt(minutes));

      // Verificar se já existe registro para este horário
      const existingIntake = intakes.find(intake => 
        intake.medication_id === medicationId &&
        format(parseISO(intake.data_horario), 'HH:mm') === horario
      );

      if (existingIntake) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('medication_intakes')
          .update({ tomado: taken })
          .eq('id', existingIntake.id);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from('medication_intakes')
          .insert({
            medication_id: medicationId,
            patient_id: patientId,
            data_horario: scheduleTime.toISOString(),
            tomado: taken
          });

        if (error) throw error;
      }

      toast({
        title: taken ? "Medicamento tomado!" : "Tomada desmarcada",
        description: taken 
          ? "Medicamento marcado como tomado." 
          : "Tomada do medicamento foi desmarcada.",
      });

      fetchTodayIntakes(patientId);
    } catch (error) {
      console.error('Erro ao marcar medicamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a tomada do medicamento.",
        variant: "destructive",
      });
    }
  };

  const getTodayIntake = (medicationId: string, horario: string) => {
    return intakes.find(intake => 
      intake.medication_id === medicationId &&
      format(parseISO(intake.data_horario), 'HH:mm') === horario
    );
  };

  const getIntakeStatus = (medicationId: string, horario: string) => {
    const intake = getTodayIntake(medicationId, horario);
    return intake?.tomado || false;
  };

  const calculateAdherence = () => {
    const totalScheduled = medications.reduce((total, med) => total + med.horarios.length, 0);
    const totalTaken = intakes.filter(intake => intake.tomado).length;
    return totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;
  };

  const handleDeleteMedication = () => {
    fetchPatientData();
    setDeleteDialog({ isOpen: false, medicationId: '', medicationName: '' });
  };

  const openDeleteDialog = (medicationId: string, medicationName: string) => {
    setDeleteDialog({ isOpen: true, medicationId, medicationName });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg"></div>
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (medications.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Nenhum medicamento ativo</h3>
          <p className="text-muted-foreground">
            Você não possui medicamentos prescritos no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const adherence = calculateAdherence();

  return (
    <div className="space-y-4">
      {/* Resumo de Aderência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sua Aderência Hoje
          </CardTitle>
          <CardDescription>
            Acompanhe o cumprimento do seu tratamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{adherence}%</p>
              <p className="text-sm text-muted-foreground">
                {intakes.filter(i => i.tomado).length} de{' '}
                {medications.reduce((total, med) => total + med.horarios.length, 0)} doses tomadas
              </p>
            </div>
            <div className="flex items-center gap-2">
              {adherence >= 80 ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : adherence >= 60 ? (
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-500" />
              )}
              <Badge variant={adherence >= 80 ? "default" : adherence >= 60 ? "secondary" : "destructive"}>
                {adherence >= 80 ? "Excelente!" : adherence >= 60 ? "Boa" : "Precisa melhorar"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Medicamentos */}
      {medications.map((medication) => (
        <Card key={medication.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{medication.nome_medicamento}</CardTitle>
                  <CardDescription>
                    Prescrito por Dr(a). {medication.prescriber?.nome}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">Ativo</Badge>
                {profile?.tipo === 'profissional' && (
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Dosagem</p>
                <p className="text-sm text-muted-foreground">{medication.dosagem}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Frequência</p>
                <p className="text-sm text-muted-foreground">{medication.frequencia}x ao dia</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Horários de hoje:</p>
              <div className="space-y-2">
                {medication.horarios.map((horario, index) => {
                  const intake = getTodayIntake(medication.id, horario);
                  const isTaken = intake?.tomado || false;
                  const currentTime = new Date();
                  const [hours, minutes] = horario.split(':');
                  const scheduleTime = new Date();
                  scheduleTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  const isPast = currentTime > scheduleTime;

                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-base font-mono text-primary font-medium">
                          {horario}
                        </div>
                        {isTaken && intake && (
                          <Badge variant="secondary" className="text-xs bg-health-success/10 text-health-success">
                            Tomado às {format(parseISO(intake.data_horario), 'HH:mm')}
                            {format(parseISO(intake.data_horario), 'HH:mm') !== horario && (
                              <span className="text-muted-foreground ml-1">
                                (previsto: {horario})
                              </span>
                            )}
                          </Badge>
                        )}
                        {!isTaken && (
                          <Badge 
                            variant="outline" 
                            className={
                              isPast 
                                ? 'text-health-danger border-health-danger' 
                                : 'text-muted-foreground'
                            }
                          >
                            {isPast ? 'Atrasado' : 'Pendente'}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isTaken ? "default" : "outline"}
                        onClick={() => markMedicationTaken(medication.id, horario, !isTaken)}
                        className={
                          isTaken ? 'bg-health-success hover:bg-health-success/80' : ''
                        }
                      >
                        {isTaken ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {medication.observacoes && (
              <div>
                <p className="text-sm font-medium">Observações</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {medication.observacoes}
                </p>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p>Início do tratamento: {format(new Date(medication.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}</p>
              {medication.data_fim && (
                <p>Fim previsto: {format(new Date(medication.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <MedicationDeleteDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, medicationId: '', medicationName: '' })}
        medicationId={deleteDialog.medicationId}
        medicationName={deleteDialog.medicationName}
        onDelete={handleDeleteMedication}
      />
    </div>
  );
};

export default PatientMedicationView;