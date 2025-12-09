import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, Check, X, Pill, AlertCircle } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Medication {
  id: string;
  nome_medicamento: string;
  dosagem: string;
  frequencia: number;
  horarios: string[];
  ativo: boolean;
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  data_horario: string;
  tomado: boolean;
  observacoes: string | null;
}

interface MedicationTrackerProps {
  patientId: string;
  isViewOnly?: boolean;
}

const MedicationTracker: React.FC<MedicationTrackerProps> = ({ 
  patientId, 
  isViewOnly = false 
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedications();
    fetchTodayIntakes();
  }, [patientId]);

  const fetchMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
    }
  };

  const fetchTodayIntakes = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const markMedicationTaken = async (medicationId: string, horario: string, taken: boolean) => {
    if (isViewOnly) return;

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

      fetchTodayIntakes();
    } catch (error) {
      console.error('Erro ao marcar medicamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a tomada do medicamento.",
        variant: "destructive",
      });
    }
  };

  const getIntakeStatus = (medicationId: string, horario: string) => {
    const intake = intakes.find(intake => 
      intake.medication_id === medicationId &&
      format(parseISO(intake.data_horario), 'HH:mm') === horario
    );
    return intake?.tomado || false;
  };

  const calculateAdherence = () => {
    const totalScheduled = medications.reduce((total, med) => total + med.horarios.length, 0);
    const totalTaken = intakes.filter(intake => intake.tomado).length;
    return totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (medications.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Pill className="h-8 w-8 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Nenhum medicamento ativo encontrado</p>
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
            Aderência de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{adherence}%</p>
              <p className="text-sm text-muted-foreground">
                {intakes.filter(i => i.tomado).length} de{' '}
                {medications.reduce((total, med) => total + med.horarios.length, 0)} doses
              </p>
            </div>
            <Badge variant={adherence >= 80 ? "default" : adherence >= 60 ? "secondary" : "destructive"}>
              {adherence >= 80 ? "Ótima" : adherence >= 60 ? "Boa" : "Precisa melhorar"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Medicamentos */}
      {medications.map((medication) => (
        <Card key={medication.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              {medication.nome_medicamento}
            </CardTitle>
            <CardDescription>
              {medication.dosagem} • {medication.frequencia}x ao dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Horários de hoje:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {medication.horarios.map((horario, index) => {
                  const isTaken = getIntakeStatus(medication.id, horario);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isTaken ? "default" : "outline"}
                        onClick={() => markMedicationTaken(medication.id, horario, !isTaken)}
                        disabled={isViewOnly}
                        className="flex-1"
                      >
                        {isTaken ? (
                          <Check className="h-4 w-4 mr-1" />
                        ) : (
                          <Clock className="h-4 w-4 mr-1" />
                        )}
                        {horario}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MedicationTracker;