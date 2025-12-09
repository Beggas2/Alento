import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pill, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Medication {
  id: string;
  nome_medicamento: string;
  dosagem: string;
  horarios: string[];
  ativo: boolean;
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  data_horario: string;
  tomado: boolean;
}

interface MedicationIntakeTrackerProps {
  selectedDate?: string;
  isReadOnly?: boolean;
}

const MedicationIntakeTracker: React.FC<MedicationIntakeTrackerProps> = ({ 
  selectedDate = format(new Date(), 'yyyy-MM-dd'),
  isReadOnly = false 
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchPatientData();
    }
  }, [profile]);

  useEffect(() => {
    if (patientId) {
      fetchMedications();
      fetchIntakes();
    }
  }, [patientId, selectedDate]);

  const fetchPatientData = async () => {
    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile?.user_id)
        .single();

      if (patient) {
        setPatientId(patient.id);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do paciente:', error);
    }
  };

  const fetchMedications = async () => {
    if (!patientId) return;

    try {
      const { data: medications, error } = await supabase
        .from('medications')
        .select('id, nome_medicamento, dosagem, horarios, ativo')
        .eq('patient_id', patientId)
        .eq('ativo', true);

      if (error) throw error;
      setMedications(medications || []);
    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
    }
  };

  const fetchIntakes = async () => {
    if (!patientId) return;

    try {
      const startDate = `${selectedDate}T00:00:00`;
      const endDate = `${selectedDate}T23:59:59`;

      const { data: intakes, error } = await supabase
        .from('medication_intakes')
        .select('*')
        .eq('patient_id', patientId)
        .gte('data_horario', startDate)
        .lte('data_horario', endDate);

      if (error) throw error;
      setIntakes(intakes || []);
    } catch (error) {
      console.error('Erro ao buscar tomadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntakeToggle = async (medicationId: string, horario: string, taken: boolean) => {
    if (isReadOnly) return;

    try {
      const now = new Date();
      const [hours, minutes] = horario.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Se é hoje e está tentando tomar antes do horário, pedir confirmação
      const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
      if (taken && isToday && now < scheduledDateTime) {
        const medication = medications.find(m => m.id === medicationId);
        const confirm = window.confirm(
          `Você está tomando ${medication?.nome_medicamento} antes do horário previsto (${horario}). ` +
          `Tem certeza que deseja registrar agora?`
        );
        if (!confirm) return;
      }
      
      const existingIntake = intakes.find(
        (intake) => {
          const intakeDateTime = new Date(intake.data_horario);
          return intake.medication_id === medicationId && 
                 format(intakeDateTime, 'HH:mm') === horario &&
                 format(intakeDateTime, 'yyyy-MM-dd') === selectedDate;
        }
      );

      if (existingIntake) {
        // Atualizar registro existente
        const { error } = await supabase
          .from('medication_intakes')
          .update({ tomado: taken })
          .eq('id', existingIntake.id);

        if (error) throw error;
      } else {
        // Para criar novo registro, usar horário atual se tomado antes do previsto hoje
        const recordTime = taken && isToday && now < scheduledDateTime ? now : scheduledDateTime;
        
        const { error } = await supabase
          .from('medication_intakes')
          .insert({
            medication_id: medicationId,
            patient_id: patientId,
            data_horario: recordTime.toISOString(),
            tomado: taken
          });

        if (error) throw error;
      }

      const medication = medications.find(m => m.id === medicationId);
      toast({
        title: taken ? "Medicamento registrado" : "Registro removido",
        description: `${medication?.nome_medicamento} às ${horario}`,
      });

      fetchIntakes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tomada do medicamento.",
        variant: "destructive",
      });
    }
  };

  const isIntakeTaken = (medicationId: string, horario: string): boolean => {
    const intake = intakes.find(
      (intake) => {
        const intakeDateTime = new Date(intake.data_horario);
        return intake.medication_id === medicationId && 
               format(intakeDateTime, 'HH:mm') === horario &&
               format(intakeDateTime, 'yyyy-MM-dd') === selectedDate;
      }
    );
    return intake?.tomado || false;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Medicamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (medications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Medicamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Nenhum medicamento ativo encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-primary" />
          Medicamentos
          {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
            <Badge variant="outline" className="ml-2">
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(selectedDate), 'dd/MM/yyyy', { locale: ptBR })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {medications.map((medication) => (
          <div key={medication.id} className="p-3 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{medication.nome_medicamento}</h4>
                <p className="text-sm text-muted-foreground">{medication.dosagem}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Horários:</div>
              <div className="grid grid-cols-2 gap-2">
                {medication.horarios.map((horario, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${medication.id}-${horario}`}
                      checked={isIntakeTaken(medication.id, horario)}
                      onCheckedChange={(checked) => 
                        handleIntakeToggle(medication.id, horario, checked as boolean)
                      }
                      disabled={isReadOnly}
                    />
                    <label
                      htmlFor={`${medication.id}-${horario}`}
                      className={`text-sm flex items-center gap-1 cursor-pointer ${
                        isIntakeTaken(medication.id, horario) 
                          ? 'line-through text-muted-foreground' 
                          : ''
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {horario}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MedicationIntakeTracker;