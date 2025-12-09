import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format, isAfter, parse, isSameDay, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Medication {
  id: string;
  nome_medicamento: string;
  dosagem: string;
  horarios: string[];
  frequencia: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  data_horario: string;
  tomado: boolean;
  observacoes: string | null;
}

interface ScheduleItem {
  medication: Medication;
  horario: string;
  intake?: MedicationIntake;
  canTake: boolean;
}

const MedicationScheduleTracker = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string>('');

  useEffect(() => {
    if (profile) {
      fetchPatientId();
    }
  }, [profile]);

  useEffect(() => {
    if (patientId) {
      fetchMedications();
      fetchTodayIntakes();
    }
  }, [patientId]);

  useEffect(() => {
    if (medications.length > 0) {
      generateTodaySchedule();
    }
  }, [medications, intakes]);

  const fetchPatientId = async () => {
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile?.user_id)
        .single();

      if (error) throw error;
      setPatientId(patient.id);
    } catch (error: any) {
      console.error('Error fetching patient ID:', error);
    }
  };

  const fetchMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('ativo', true)
        .order('nome_medicamento');

      if (error) throw error;
      setMedications(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar medicamentos",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchTodayIntakes = async () => {
    try {
      const start = startOfDay(new Date());
      const end = addDays(start, 1);
      const { data, error } = await supabase
        .from('medication_intakes')
        .select('*')
        .eq('patient_id', patientId)
        .gte('data_horario', start.toISOString())
        .lt('data_horario', end.toISOString());

      if (error) throw error;
      setIntakes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar registros",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTodaySchedule = () => {
    const now = new Date();
    const todaySchedule: ScheduleItem[] = [];

    medications.forEach((medication) => {
      // Intakes do dia para este medicamento, ordenados por horário real
      const medIntakes = intakes
        .filter(
          (intake) => intake.medication_id === medication.id && isSameDay(new Date(intake.data_horario), now)
        )
        .sort(
          (a, b) => new Date(a.data_horario).getTime() - new Date(b.data_horario).getTime()
        );

      const used = new Set<string>();
      const sortedHorarios = [...medication.horarios].sort((a, b) => a.localeCompare(b));

      sortedHorarios.forEach((horario) => {
        // Hora prevista (HH:mm)
        const [hours, minutes] = horario.split(':').map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Encontrar o registro mais próximo dentro de uma janela de ±3h
        const THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 horas
        let best: MedicationIntake | undefined;
        let bestDiff = Infinity;
        for (const intake of medIntakes) {
          if (used.has(intake.id)) continue;
          const diff = Math.abs(new Date(intake.data_horario).getTime() - scheduledTime.getTime());
          if (diff <= THRESHOLD_MS && diff < bestDiff) {
            bestDiff = diff;
            best = intake;
          }
        }
        if (best) used.add(best.id);

        // Sempre permitir marcar no dia atual
        todaySchedule.push({
          medication,
          horario,
          intake: best,
          canTake: true,
        });
      });
    });

    // Ordenar por horário
    todaySchedule.sort((a, b) => a.horario.localeCompare(b.horario));
    setSchedule(todaySchedule);
  };

  const handleIntakeToggle = async (item: ScheduleItem, taken: boolean) => {
    try {
      console.log('handleIntakeToggle called:', { 
        medication: item.medication.nome_medicamento,
        horario: item.horario,
        taken, 
        canTake: item.canTake,
        hasIntake: !!item.intake,
        disabled: !item.canTake && !item.intake
      });
      
      const now = new Date();
      const [hours, minutes] = item.horario.split(':').map(Number);
      const scheduledDateTime = new Date();
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      // Verificar se está tentando tomar antes do horário
      if (taken && now < scheduledDateTime && !item.intake) {
        const confirm = window.confirm(
          `Você está tomando ${item.medication.nome_medicamento} antes do horário previsto (${item.horario}). ` +
          `Tem certeza que deseja registrar agora?`
        );
        if (!confirm) return;
      }

      if (item.intake) {
        // Atualizar registro existente
        console.log('Updating existing intake:', item.intake.id);
        const { error } = await supabase
          .from('medication_intakes')
          .update({ 
            tomado: taken,
            data_horario: taken ? now.toISOString() : item.intake.data_horario,
            updated_at: now.toISOString()
          })
          .eq('id', item.intake.id);

        if (error) {
          console.error('Error updating intake:', error);
          throw error;
        }
      } else {
        // Criar novo registro sempre com o horário atual real
        console.log('Creating new intake:', {
          medication_id: item.medication.id,
          patient_id: patientId,
          data_horario: now.toISOString(), // Sempre usa o horário atual
          tomado: taken
        });

        const { error } = await supabase
          .from('medication_intakes')
          .insert({
            medication_id: item.medication.id,
            patient_id: patientId,
            data_horario: now.toISOString(), // Registra o horário real que foi marcado
            tomado: taken
          });

        if (error) {
          console.error('Error creating intake:', error);
          throw error;
        }
      }

      // Atualizar a lista local
      await fetchTodayIntakes();

      toast({
        title: taken ? "Medicamento registrado" : "Registro removido",
        description: `${item.medication.nome_medicamento} às ${item.horario}`,
        variant: "default"
      });
    } catch (error: any) {
      console.error('Error in handleIntakeToggle:', error);
      toast({
        title: "Erro ao registrar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (item: ScheduleItem) => {
    if (item.intake?.tomado) {
      return <Badge variant="outline" className="text-health-success border-health-success">Tomado</Badge>;
    }
    
    const now = new Date();
    const [hours, minutes] = item.horario.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    const twoHoursLater = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
    
    if (now < scheduledTime) {
      return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
    } else if (now <= twoHoursLater) {
      return <Badge variant="outline" className="text-health-warning border-health-warning">Disponível</Badge>;
    } else {
      return <Badge variant="outline" className="text-health-danger border-health-danger">Atrasado</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-muted-foreground">Carregando cronograma...</div>
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Nenhum medicamento agendado</h3>
          <p className="text-muted-foreground">
            Quando você tiver medicamentos prescritos, eles aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Cronograma de Hoje</h3>
        <Badge variant="outline" className="ml-auto">
          {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
        </Badge>
      </div>

      <div className="grid gap-3">
        {schedule.map((item, index) => (
          <Card key={`${item.medication.id}-${item.horario}`} className="border-l-4 border-l-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono text-primary">
                      {item.horario}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">
                        {item.medication.nome_medicamento}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {item.medication.dosagem}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(item)}
                  
                  <Checkbox
                    checked={item.intake?.tomado || false}
                    disabled={!item.canTake && !item.intake}
                    onCheckedChange={(checked) => 
                      handleIntakeToggle(item, checked as boolean)
                    }
                    className="h-6 w-6"
                  />
                </div>
              </div>

              {item.intake?.tomado && (
                <div className="mt-3 flex items-center gap-2 text-sm text-health-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Tomado às {format(new Date(item.intake.data_horario), 'HH:mm')}
                    {format(new Date(item.intake.data_horario), 'HH:mm') !== item.horario && (
                      <span className="text-muted-foreground ml-1">
                        (previsto: {item.horario})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumo do dia */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo do Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total de medicamentos:</span>
            <span className="font-medium">{schedule.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Tomados:</span>
            <span className="font-medium text-health-success">
              {schedule.filter(item => item.intake?.tomado).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pendentes:</span>
            <span className="font-medium text-muted-foreground">
              {schedule.filter(item => {
                if (item.intake?.tomado) return false;
                const now = new Date();
                const [hours, minutes] = item.horario.split(':').map(Number);
                const scheduledTime = new Date();
                scheduledTime.setHours(hours, minutes, 0, 0);
                return now < scheduledTime;
              }).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Disponíveis:</span>
            <span className="font-medium text-health-warning">
              {schedule.filter(item => {
                if (item.intake?.tomado) return false;
                const now = new Date();
                const [hours, minutes] = item.horario.split(':').map(Number);
                const scheduledTime = new Date();
                scheduledTime.setHours(hours, minutes, 0, 0);
                const twoHoursLater = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
                return now >= scheduledTime && now <= twoHoursLater;
              }).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Atrasados:</span>
            <span className="font-medium text-health-danger">
              {schedule.filter(item => {
                if (item.intake?.tomado) return false;
                const now = new Date();
                const [hours, minutes] = item.horario.split(':').map(Number);
                const scheduledTime = new Date();
                scheduledTime.setHours(hours, minutes, 0, 0);
                const twoHoursLater = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
                return now > twoHoursLater;
              }).length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicationScheduleTracker;