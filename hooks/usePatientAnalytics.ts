import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

export interface CorrelationData {
  variable1: string;
  variable2: string;
  correlation: number;
  pValue: number;
  sampleSize: number;
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative';
  interpretation: string;
  confidenceInterval?: [number, number];
}

export interface TimeSeriesData {
  date: string;
  mood: number | null;
  sleep: number | null;
  energy: number | null;
  medication_adherence: number | null;
  phq9_score?: number | null;
  gad7_score?: number | null;
}

export interface AnalyticsInsight {
  type: 'correlation' | 'trend' | 'anomaly';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendation?: string;
}

export const usePatientAnalytics = (patientId: string) => {
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePearsonCorrelation = useCallback((x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }, []);

  const calculateSpearmanCorrelation = useCallback((x: number[], y: number[]): number => {
    // Convert to ranks
    const getRanks = (arr: number[]) => {
      const sorted = [...arr].map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
      const ranks = new Array(arr.length);
      for (let i = 0; i < sorted.length; i++) {
        ranks[sorted[i].idx] = i + 1;
      }
      return ranks;
    };

    const ranksX = getRanks(x);
    const ranksY = getRanks(y);
    
    return calculatePearsonCorrelation(ranksX, ranksY);
  }, [calculatePearsonCorrelation]);

  const calculatePValue = useCallback((r: number, n: number): number => {
    if (n < 3) return 1;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    // Simplified p-value calculation - in practice, you'd use a proper t-distribution
    const df = n - 2;
    const tAbs = Math.abs(t);
    
    // Rough approximation for p-value
    if (tAbs > 2.5) return 0.01;
    if (tAbs > 2.0) return 0.05;
    if (tAbs > 1.5) return 0.1;
    return 0.2;
  }, []);

  const calculateConfidenceInterval = useCallback((r: number, n: number, confidence = 0.95): [number, number] => {
    if (n < 4) return [r, r];
    
    // Fisher's z-transformation
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const zCritical = confidence === 0.95 ? 1.96 : 2.576; // 95% or 99%
    
    const zLower = z - zCritical * se;
    const zUpper = z + zCritical * se;
    
    // Transform back
    const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
    const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);
    
    return [Math.max(-1, rLower), Math.min(1, rUpper)];
  }, []);

  const determineCorrelationType = useCallback((x: number[], y: number[]): 'pearson' | 'spearman' => {
    // Simple heuristic: if data seems ordinal or non-linear, use Spearman
    const checkNormality = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
      const skewness = arr.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / (arr.length * Math.pow(variance, 1.5));
      return Math.abs(skewness) < 1; // Rough normality check
    };

    const xNormal = checkNormality(x);
    const yNormal = checkNormality(y);
    
    return (xNormal && yNormal) ? 'pearson' : 'spearman';
  }, []);

  const generateInsights = useCallback((correlationData: CorrelationData[], timeData: TimeSeriesData[]): AnalyticsInsight[] => {
    const insights: AnalyticsInsight[] = [];

    // Strong correlation insights
    correlationData.forEach(corr => {
      if (corr.strength === 'strong' && corr.pValue < 0.05) {
        insights.push({
          type: 'correlation',
          severity: 'high',
          title: `Correlação forte detectada`,
          description: `${corr.variable1} e ${corr.variable2} mostram correlação ${corr.direction} forte (r=${corr.correlation.toFixed(2)})`,
          recommendation: corr.direction === 'positive' 
            ? `Focar em melhorar ${corr.variable1} pode ter impacto positivo em ${corr.variable2}`
            : `Mudanças em ${corr.variable1} podem afetar negativamente ${corr.variable2} - monitorar cuidadosamente`
        });
      }
    });

    // Trend insights
    if (timeData.length >= 7) {
      const recentData = timeData.slice(-7);
      const moodTrend = recentData.filter(d => d.mood !== null).map(d => d.mood!);
      
      if (moodTrend.length >= 5) {
        const firstHalf = moodTrend.slice(0, Math.floor(moodTrend.length / 2));
        const secondHalf = moodTrend.slice(Math.floor(moodTrend.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const change = avgSecond - avgFirst;
        if (Math.abs(change) > 1) {
          insights.push({
            type: 'trend',
            severity: Math.abs(change) > 2 ? 'high' : 'medium',
            title: change > 0 ? 'Melhora no humor detectada' : 'Declínio no humor detectado',
            description: `Humor ${change > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(change).toFixed(1)} pontos nos últimos dias`,
            recommendation: change < 0 
              ? 'Considerar ajustes no tratamento ou intervenção adicional'
              : 'Identificar fatores que contribuíram para a melhora'
          });
        }
      }
    }

    return insights;
  }, []);

  const fetchAnalyticsData = useCallback(async (
    timeWindow: '7' | '30' | '90' | 'custom',
    customStart?: Date,
    customEnd?: Date
  ) => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const start = timeWindow === 'custom' && customStart ? customStart : subDays(now, parseInt(timeWindow));
      const end = timeWindow === 'custom' && customEnd ? customEnd : now;

      // Check for cached data
      const { data: cachedData } = await supabase
        .from('analytics_snapshot')
        .select('*')
        .eq('patient_id', patientId)
        .eq('window_start', format(start, 'yyyy-MM-dd'))
        .eq('window_end', format(end, 'yyyy-MM-dd'))
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedData && Date.now() - new Date(cachedData.computed_at).getTime() < 3600000) {
        const payload = cachedData.payload_json as any;
        setCorrelations(payload.correlations || []);
        setTimeSeriesData(payload.timeSeriesData || []);
        setInsights(payload.insights || []);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      const [dailyRecordsResult, medicationResult, questionnaireResult] = await Promise.all([
        supabase
          .from('daily_records')
          .select('*')
          .eq('patient_id', patientId)
          .gte('data', format(start, 'yyyy-MM-dd'))
          .lte('data', format(end, 'yyyy-MM-dd'))
          .order('data', { ascending: true }),
        
        supabase
          .from('medication_intakes')
          .select(`
            data_horario,
            tomado,
            medication_id,
            medications(horarios)
          `)
          .eq('patient_id', patientId)
          .gte('data_horario', start.toISOString())
          .lte('data_horario', end.toISOString()),

        supabase
          .from('questionnaire_responses')
          .select(`
            response_value,
            answered_at,
            questionnaire_questions(questionnaire_id),
            questionnaires(code)
          `)
          .eq('patient_id', patientId)
          .gte('answered_at', start.toISOString())
          .lte('answered_at', end.toISOString())
      ]);

      if (dailyRecordsResult.error) throw dailyRecordsResult.error;
      if (medicationResult.error) throw medicationResult.error;
      if (questionnaireResult.error) throw questionnaireResult.error;

      // Process data
      const processedData = processDataForAnalysis(
        dailyRecordsResult.data || [],
        medicationResult.data || [],
        questionnaireResult.data || []
      );
      
      const correlationResults = calculateCorrelations(processedData);
      const generatedInsights = generateInsights(correlationResults, processedData);

      // Cache results
      const analyticsPayload = {
        correlations: correlationResults,
        timeSeriesData: processedData,
        insights: generatedInsights,
        computedAt: new Date().toISOString()
      };

      await supabase
        .from('analytics_snapshot')
        .insert({
          patient_id: patientId,
          window_start: format(start, 'yyyy-MM-dd'),
          window_end: format(end, 'yyyy-MM-dd'),
          payload_json: analyticsPayload as any
        });

      setCorrelations(correlationResults);
      setTimeSeriesData(processedData);
      setInsights(generatedInsights);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId, calculatePearsonCorrelation, generateInsights]);

  const processDataForAnalysis = useCallback((
    records: any[],
    medicationData: any[],
    questionnaireData: any[]
  ): TimeSeriesData[] => {
    // Group medication data by date
    const medicationByDate = medicationData.reduce((acc, intake) => {
      const date = format(new Date(intake.data_horario), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { taken: 0, scheduled: 0 };
      }
      if (intake.tomado) acc[date].taken++;
      if (intake.medications?.horarios) {
        acc[date].scheduled += intake.medications.horarios.length;
      }
      return acc;
    }, {});

    // Group questionnaire data by date and type
    const questionnaireByDate = questionnaireData.reduce((acc, response) => {
      const date = format(new Date(response.answered_at), 'yyyy-MM-dd');
      const questType = response.questionnaires?.code;
      
      if (!acc[date]) acc[date] = {};
      if (!acc[date][questType]) acc[date][questType] = [];
      acc[date][questType].push(response.response_value);
      
      return acc;
    }, {});

    return records.map(record => {
      const medData = medicationByDate[record.data];
      const questData = questionnaireByDate[record.data];
      
      return {
        date: record.data,
        mood: record.humor ? parseInt(record.humor) : null,
        sleep: record.sleep_hours || null,
        energy: record.energia || null,
        medication_adherence: medData 
          ? Math.round((medData.taken / Math.max(medData.scheduled, 1)) * 100)
          : null,
        phq9_score: questData?.['PHQ-9'] 
          ? questData['PHQ-9'].reduce((a: number, b: number) => a + b, 0)
          : null,
        gad7_score: questData?.['GAD-7'] 
          ? questData['GAD-7'].reduce((a: number, b: number) => a + b, 0)
          : null
      };
    });
  }, []);

  const calculateCorrelations = useCallback((data: TimeSeriesData[]): CorrelationData[] => {
    const variables = [
      { key: 'mood', name: 'Humor' },
      { key: 'sleep', name: 'Sono (horas)' },
      { key: 'energy', name: 'Energia' },
      { key: 'medication_adherence', name: 'Aderência Medicamentosa' },
      { key: 'phq9_score', name: 'PHQ-9 Score' },
      { key: 'gad7_score', name: 'GAD-7 Score' }
    ];

    const correlations: CorrelationData[] = [];

    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const var1 = variables[i];
        const var2 = variables[j];
        
        const validData = data.filter(d => 
          d[var1.key as keyof TimeSeriesData] !== null && 
          d[var2.key as keyof TimeSeriesData] !== null
        );

        if (validData.length < 10) continue; // Insufficient data

        const values1 = validData.map(d => d[var1.key as keyof TimeSeriesData] as number);
        const values2 = validData.map(d => d[var2.key as keyof TimeSeriesData] as number);

        const correlationType = determineCorrelationType(values1, values2);
        const correlation = correlationType === 'pearson' 
          ? calculatePearsonCorrelation(values1, values2)
          : calculateSpearmanCorrelation(values1, values2);
        
        if (isNaN(correlation)) continue;

        const pValue = calculatePValue(correlation, validData.length);
        const confidenceInterval = calculateConfidenceInterval(correlation, validData.length);
        
        const absCorr = Math.abs(correlation);
        const strength = absCorr >= 0.7 ? 'strong' : absCorr >= 0.3 ? 'moderate' : 'weak';
        const direction = correlation > 0 ? 'positive' : 'negative';
        
        const interpretation = generateInterpretation(var1.name, var2.name, correlation, strength, pValue);

        correlations.push({
          variable1: var1.name,
          variable2: var2.name,
          correlation,
          pValue,
          sampleSize: validData.length,
          strength,
          direction,
          interpretation,
          confidenceInterval
        });
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [calculatePearsonCorrelation, calculateSpearmanCorrelation, calculatePValue, calculateConfidenceInterval, determineCorrelationType]);

  const generateInterpretation = useCallback((
    var1: string, 
    var2: string, 
    correlation: number, 
    strength: string, 
    pValue: number
  ): string => {
    const direction = correlation > 0 ? 'positiva' : 'negativa';
    const significance = pValue < 0.05 ? 'significativa' : 'não significativa';
    
    if (strength === 'strong' && pValue < 0.05) {
      return `Correlação ${direction} forte e ${significance} entre ${var1} e ${var2}`;
    } else if (strength === 'moderate' && pValue < 0.05) {
      return `Correlação ${direction} moderada e ${significance} entre ${var1} e ${var2}`;
    } else {
      return `Correlação ${direction} fraca ou ${significance} entre ${var1} e ${var2}`;
    }
  }, []);

  return {
    correlations,
    timeSeriesData,
    insights,
    loading,
    error,
    fetchAnalyticsData
  };
};