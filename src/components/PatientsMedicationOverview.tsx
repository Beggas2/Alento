import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Pill, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PatientAdherence {
  patientId: string;
  patientName: string;
  totalDoses: number;
  takenDoses: number;
  adherencePercentage: number;
  medications: Array<{
    id: string;
    name: string;
    prescriber: string;
    scheduledTimes: string[];
    takenTimes: string[];
  }>;
}

interface PatientsMedicationOverviewProps {
  professionalId: string;
  selectedPatientId?: string;
  onPatientSelect?: (patientId: string) => void;
}

const PatientsMedicationOverview: React.FC<PatientsMedicationOverviewProps> = ({
  professionalId,
  selectedPatientId,
  onPatientSelect
}) => {
  const [patientsAdherence, setPatientsAdherence] = useState<PatientAdherence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (professionalId) {
      fetchPatientsAdherence();
    }
  }, [professionalId]);

  const fetchPatientsAdherence = async () => {
    try {
      setLoading(true);

      // Buscar todos os pacientes do profissional através da tabela patient_professionals
      const { data: patientProfessionals, error: patientProfessionalsError } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients!inner(
            id,
            user_id,
            ativo
          )
        `)
        .eq('professional_id', professionalId)
        .eq('status', 'active')
        .eq('patients.ativo', true);

      if (patientProfessionalsError) throw patientProfessionalsError;

      const patients = patientProfessionals?.map(pp => pp.patients).filter(Boolean) || [];

      

      if (!patients || patients.length === 0) {
        setPatientsAdherence([]);
        setLoading(false);
        return;
      }

      // Buscar os perfis dos pacientes
      const userIds = patients.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('nome, user_id')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Erro ao buscar perfis dos pacientes:', profilesError);
        throw profilesError;
      }

      const adherenceData: PatientAdherence[] = [];

      for (const patient of patients) {
        // Buscar todos os medicamentos ativos do paciente (de qualquer profissional)
        const { data: medications, error: medicationsError } = await supabase
          .from('medications')
          .select(`
            *,
            prescriber_profile:profiles!medications_prescrito_por_fkey(nome)
          `)
          .eq('patient_id', patient.id)
          .eq('ativo', true);

        if (medicationsError) throw medicationsError;

        if (!medications || medications.length === 0) {
          // Pular pacientes sem medicamentos ativos - não incluir na estatística de aderência
          continue;
        }

        // Buscar intakes de hoje
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: intakes, error: intakesError } = await supabase
          .from('medication_intakes')
          .select('*')
          .eq('patient_id', patient.id)
          .gte('data_horario', startOfDay.toISOString())
          .lte('data_horario', endOfDay.toISOString());

        if (intakesError) throw intakesError;

        let totalDoses = 0;
        let takenDoses = 0;
        const medicationsData = [];

        for (const medication of medications) {
          const scheduledTimes = medication.horarios || [];
          totalDoses += scheduledTimes.length;

          const medicationIntakes = intakes?.filter(
            intake => intake.medication_id === medication.id && intake.tomado
          ) || [];

          takenDoses += medicationIntakes.length;

          medicationsData.push({
            id: medication.id,
            name: medication.nome_medicamento,
            prescriber: medication.prescriber_profile?.nome || 'Não informado',
            scheduledTimes,
            takenTimes: medicationIntakes.map(intake => 
              format(new Date(intake.data_horario), 'HH:mm')
            )
          });
        }

        const adherencePercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

        const patientProfile = profiles?.find(profile => profile.user_id === patient.user_id);
        const patientName = patientProfile?.nome || 'Nome não encontrado';

        adherenceData.push({
          patientId: patient.id,
          patientName,
          totalDoses,
          takenDoses,
          adherencePercentage,
          medications: medicationsData
        });
      }

      setPatientsAdherence(adherenceData);
    } catch (error) {
      console.error('Erro ao buscar aderência dos pacientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAdherenceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAdherenceIcon = (percentage: number) => {
    if (percentage >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (percentage >= 50) return <Clock className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Visão Geral - Aderência aos Medicamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (patientsAdherence.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Visão Geral - Aderência aos Medicamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum paciente com medicamentos ativos encontrado
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Medicamentos prescritos por qualquer profissional aparecerão aqui quando houver
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallStats = patientsAdherence.reduce(
    (acc, patient) => ({
      totalPatients: acc.totalPatients + 1,
      totalDoses: acc.totalDoses + patient.totalDoses,
      totalTaken: acc.totalTaken + patient.takenDoses,
      highAdherence: acc.highAdherence + (patient.adherencePercentage >= 80 ? 1 : 0),
      mediumAdherence: acc.mediumAdherence + (patient.adherencePercentage >= 50 && patient.adherencePercentage < 80 ? 1 : 0),
      lowAdherence: acc.lowAdherence + (patient.adherencePercentage < 50 ? 1 : 0)
    }),
    { totalPatients: 0, totalDoses: 0, totalTaken: 0, highAdherence: 0, mediumAdherence: 0, lowAdherence: 0 }
  );

  const overallAdherence = overallStats.totalDoses > 0 
    ? Math.round((overallStats.totalTaken / overallStats.totalDoses) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Visão Geral - Aderência aos Medicamentos
            <Badge variant="outline" className="ml-2">
              Hoje - {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{overallStats.totalPatients}</div>
              <div className="text-sm text-muted-foreground">Pacientes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{overallStats.totalTaken}/{overallStats.totalDoses}</div>
              <div className="text-sm text-muted-foreground">Doses Tomadas</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getAdherenceColor(overallAdherence)}`}>
                {overallAdherence}%
              </div>
              <div className="text-sm text-muted-foreground">Aderência Geral</div>
            </div>
            <div className="flex justify-center gap-2">
              <div className="text-center">
                <div className="text-sm font-medium text-green-600">{overallStats.highAdherence}</div>
                <div className="text-xs text-muted-foreground">Alta</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-yellow-600">{overallStats.mediumAdherence}</div>
                <div className="text-xs text-muted-foreground">Média</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-red-600">{overallStats.lowAdherence}</div>
                <div className="text-xs text-muted-foreground">Baixa</div>
              </div>
            </div>
          </div>
          
          <Progress value={overallAdherence} className="h-2" />
        </CardContent>
      </Card>

      {/* Lista de Pacientes */}
      <div className="grid gap-4">
        {patientsAdherence.map((patient) => (
          <Card 
            key={patient.patientId} 
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedPatientId === patient.patientId ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onPatientSelect?.(patient.patientId)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getAdherenceIcon(patient.adherencePercentage)}
                  <div>
                    <h4 className="font-semibold text-foreground">{patient.patientName}</h4>
                    <div className="text-sm text-muted-foreground">
                      {patient.medications.length} medicamento(s) ativo(s)
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {patient.takenDoses}/{patient.totalDoses} doses
                    </div>
                    <div className={`text-sm font-bold ${getAdherenceColor(patient.adherencePercentage)}`}>
                      {patient.adherencePercentage}% aderência
                    </div>
                  </div>
                  
                  <div className="w-16">
                    <Progress value={patient.adherencePercentage} className="h-2" />
                  </div>
                </div>
              </div>
              
              {patient.medications.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {patient.medications.map((med) => (
                      <div key={med.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground truncate font-medium">{med.name}</span>
                            <span className="text-xs text-muted-foreground">Prescrito por: {med.prescriber}</span>
                          </div>
                          <span className="text-foreground ml-2">
                            {med.takenTimes.length}/{med.scheduledTimes.length}
                          </span>
                        </div>
                        {med.takenTimes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-muted-foreground text-xs">Tomado:</span>
                            {med.takenTimes.map((time, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs px-1 py-0 h-4">
                                {time}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PatientsMedicationOverview;