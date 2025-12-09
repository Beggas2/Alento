import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

export interface PatientMetrics {
  patientId: string;
  patientIdentifier: string; // De-identified (initials or pseudonym)
  patientName?: string; // Only if de-identification is disabled
  mood_avg: number | null;
  sleep_avg: number | null;
  energy_avg: number | null;
  medication_adherence_avg: number | null;
  phq9_avg: number | null;
  gad7_avg: number | null;
  crisis_alerts_count: number;
  age?: number;
  gender?: string;
  diagnosis?: string[];
  riskTier?: 'low' | 'medium' | 'high';
}

export interface ComparisonFilters {
  ageRange?: [number, number];
  gender?: string;
  diagnosis?: string[];
  riskTier?: 'low' | 'medium' | 'high' | 'all';
  adherenceLevel?: 'low' | 'medium' | 'high' | 'all';
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface CohortStats {
  metric: string;
  mean: number;
  median: number;
  q25: number;
  q75: number;
  min: number;
  max: number;
  count: number;
}

export interface TimeSeriesComparison {
  date: string;
  patients: Record<string, number | null>; // patientId -> value
}

export const useMultiPatientAnalytics = () => {
  const [patientMetrics, setPatientMetrics] = useState<PatientMetrics[]>([]);
  const [cohortStats, setCohortStats] = useState<CohortStats[]>([]);
  const [timeSeriesComparison, setTimeSeriesComparison] = useState<TimeSeriesComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deIdentified, setDeIdentified] = useState(true);

  const generatePatientIdentifier = useCallback((patientId: string, name: string): string => {
    if (!deIdentified) return name;
    
    // Create initials or pseudonym for de-identification
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
    }
    return `P${patientId.slice(-3)}`;
  }, [deIdentified]);

  const calculatePercentile = useCallback((arr: number[], percentile: number): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    if (Number.isInteger(index)) {
      return sorted[index];
    }
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }, []);

  const calculateCohortStats = useCallback((data: PatientMetrics[]): CohortStats[] => {
    const metrics = [
      { key: 'mood_avg', name: 'Humor Médio' },
      { key: 'sleep_avg', name: 'Sono Médio (h)' },
      { key: 'energy_avg', name: 'Energia Média' },
      { key: 'medication_adherence_avg', name: 'Aderência Medicamentosa (%)' },
      { key: 'phq9_avg', name: 'PHQ-9 Médio' },
      { key: 'gad7_avg', name: 'GAD-7 Médio' },
      { key: 'crisis_alerts_count', name: 'Alertas de Crise' }
    ];

    return metrics.map(metric => {
      const values = data
        .map(p => p[metric.key as keyof PatientMetrics] as number)
        .filter(v => v !== null && v !== undefined);

      if (values.length === 0) {
        return {
          metric: metric.name,
          mean: 0,
          median: 0,
          q25: 0,
          q75: 0,
          min: 0,
          max: 0,
          count: 0
        };
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const mean = sum / values.length;
      const median = calculatePercentile(values, 50);
      const q25 = calculatePercentile(values, 25);
      const q75 = calculatePercentile(values, 75);

      return {
        metric: metric.name,
        mean: Number(mean.toFixed(2)),
        median: Number(median.toFixed(2)),
        q25: Number(q25.toFixed(2)),
        q75: Number(q75.toFixed(2)),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    });
  }, [calculatePercentile]);

  const logAuditEvent = useCallback(async (action: string, details: any) => {
    try {
      await supabase.from('audit_log').insert({
        action,
        entity: 'multi_patient_analytics',
        entity_id: crypto.randomUUID(),
        after_data: details
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }, []);

  const fetchMultiPatientData = useCallback(async (filters: ComparisonFilters) => {
    setLoading(true);
    setError(null);

    try {
      // Get professional's patients
      const { data: linkedPatients, error: patientsError } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients!inner(
            id,
            user_id,
            data_nascimento,
            genero,
            profiles!inner(nome)
          )
        `)
        .eq('status', 'active');

      if (patientsError) throw patientsError;

      const patientIds = linkedPatients?.map(lp => lp.patient_id) || [];
      
      if (patientIds.length === 0) {
        setPatientMetrics([]);
        setCohortStats([]);
        setTimeSeriesComparison([]);
        setLoading(false);
        return;
      }

      // Fetch daily records for the date range
      const { data: dailyRecords, error: recordsError } = await supabase
        .from('daily_records')
        .select('*')
        .in('patient_id', patientIds)
        .gte('data', format(filters.dateRange.start, 'yyyy-MM-dd'))
        .lte('data', format(filters.dateRange.end, 'yyyy-MM-dd'));

      if (recordsError) throw recordsError;

      // Fetch medication adherence data
      const { data: medicationData, error: medError } = await supabase
        .from('medication_intakes')
        .select(`
          patient_id,
          data_horario,
          tomado,
          medications(horarios)
        `)
        .in('patient_id', patientIds)
        .gte('data_horario', filters.dateRange.start.toISOString())
        .lte('data_horario', filters.dateRange.end.toISOString());

      if (medError) throw medError;

      // Fetch questionnaire responses
      const { data: questionnaireData, error: questError } = await supabase
        .from('questionnaire_responses')
        .select(`
          patient_id,
          response_value,
          answered_at,
          questionnaire_questions(questionnaire_id),
          questionnaires(code)
        `)
        .in('patient_id', patientIds)
        .gte('answered_at', filters.dateRange.start.toISOString())
        .lte('answered_at', filters.dateRange.end.toISOString());

      if (questError) throw questError;

      // Fetch clinical alerts for crisis count
      const { data: alertsData, error: alertsError } = await supabase
        .from('clinical_alerts')
        .select('record_id, daily_records!inner(patient_id)')
        .in('daily_records.patient_id', patientIds)
        .eq('alert_level', 'high')
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());

      if (alertsError) throw alertsError;

      // Process data for each patient
      const processedMetrics = linkedPatients?.map(lp => {
        const patient = lp.patients;
        const patientRecords = dailyRecords?.filter(dr => dr.patient_id === lp.patient_id) || [];
        const patientMedData = medicationData?.filter(md => md.patient_id === lp.patient_id) || [];
        const patientQuestData = questionnaireData?.filter(qd => qd.patient_id === lp.patient_id) || [];
        const patientAlerts = alertsData?.filter(ad => ad.daily_records?.patient_id === lp.patient_id) || [];

        // Calculate averages
        const moodValues = patientRecords.map(r => r.humor ? parseInt(r.humor) : null).filter(v => v !== null);
        const sleepValues = patientRecords.map(r => r.sleep_hours).filter(v => v !== null);
        const energyValues = patientRecords.map(r => r.energia).filter(v => v !== null);

        // Calculate medication adherence
        const medicationByDate = patientMedData.reduce((acc: any, intake) => {
          const date = format(new Date(intake.data_horario), 'yyyy-MM-dd');
          if (!acc[date]) acc[date] = { taken: 0, scheduled: 0 };
          if (intake.tomado) acc[date].taken++;
          if (intake.medications?.horarios) {
            acc[date].scheduled += intake.medications.horarios.length;
          }
          return acc;
        }, {});

        const adherenceRates = Object.values(medicationByDate).map((day: any) => 
          day.scheduled > 0 ? (day.taken / day.scheduled) * 100 : 0
        );

        // Calculate questionnaire averages
        const phq9Responses = patientQuestData
          .filter(qd => qd.questionnaires?.code === 'PHQ-9')
          .map(qd => qd.response_value);
        const gad7Responses = patientQuestData
          .filter(qd => qd.questionnaires?.code === 'GAD-7')
          .map(qd => qd.response_value);

        // Calculate age
        const age = patient.data_nascimento 
          ? new Date().getFullYear() - new Date(patient.data_nascimento).getFullYear()
          : undefined;

        // Apply filters
        if (filters.ageRange && age && (age < filters.ageRange[0] || age > filters.ageRange[1])) {
          return null;
        }
        if (filters.gender && patient.genero !== filters.gender) {
          return null;
        }

        const patientMetric: PatientMetrics = {
          patientId: lp.patient_id,
          patientIdentifier: generatePatientIdentifier(lp.patient_id, patient.profiles.nome),
          patientName: deIdentified ? undefined : patient.profiles.nome,
          mood_avg: moodValues.length > 0 ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length : null,
          sleep_avg: sleepValues.length > 0 ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null,
          energy_avg: energyValues.length > 0 ? energyValues.reduce((a, b) => a + b, 0) / energyValues.length : null,
          medication_adherence_avg: adherenceRates.length > 0 ? adherenceRates.reduce((a, b) => a + b, 0) / adherenceRates.length : null,
          phq9_avg: phq9Responses.length > 0 ? phq9Responses.reduce((a, b) => a + b, 0) / phq9Responses.length : null,
          gad7_avg: gad7Responses.length > 0 ? gad7Responses.reduce((a, b) => a + b, 0) / gad7Responses.length : null,
          crisis_alerts_count: patientAlerts.length,
          age,
          gender: patient.genero || undefined
        };

        return patientMetric;
      }).filter(Boolean) as PatientMetrics[];

      setPatientMetrics(processedMetrics);
      setCohortStats(calculateCohortStats(processedMetrics));

      // Log audit event
      await logAuditEvent('multi_patient_analytics_view', {
        patientCount: processedMetrics.length,
        filters,
        deIdentified,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados comparativos');
      console.error('Multi-patient analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [deIdentified, generatePatientIdentifier, calculateCohortStats, logAuditEvent]);

  const exportData = useCallback(async (format: 'csv' | 'pdf', data: PatientMetrics[]) => {
    try {
      // Log export audit event
      await logAuditEvent('multi_patient_analytics_export', {
        format,
        patientCount: data.length,
        deIdentified,
        timestamp: new Date().toISOString()
      });

      if (format === 'csv') {
        const headers = [
          'Identificador',
          'Humor Médio',
          'Sono Médio (h)',
          'Energia Média',
          'Aderência Medicamentosa (%)',
          'PHQ-9 Médio',
          'GAD-7 Médio',
          'Alertas de Crise'
        ];

        const csvContent = [
          headers.join(','),
          ...data.map(patient => [
            patient.patientIdentifier,
            patient.mood_avg?.toFixed(2) || '',
            patient.sleep_avg?.toFixed(2) || '',
            patient.energy_avg?.toFixed(2) || '',
            patient.medication_adherence_avg?.toFixed(2) || '',
            patient.phq9_avg?.toFixed(2) || '',
            patient.gad7_avg?.toFixed(2) || '',
            patient.crisis_alerts_count
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analise_comparativa_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }, [deIdentified, logAuditEvent]);

  return {
    patientMetrics,
    cohortStats,
    timeSeriesComparison,
    loading,
    error,
    deIdentified,
    setDeIdentified,
    fetchMultiPatientData,
    exportData
  };
};