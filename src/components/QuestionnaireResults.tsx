import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, Clock, PauseCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuestionnaireResult {
  questionnaire_id: string;
  questionnaire_name: string;
  questionnaire_code: string;
  questions_answered: number;
  total_questions: number;
  status: string;
  completed_at?: string;
  last_response_date?: string;
  total_score?: number;
  risk_level?: string;
}

interface QuestionnaireResultsProps {
  patientId: string;
}

export function QuestionnaireResults({ patientId }: QuestionnaireResultsProps) {
  const [results, setResults] = useState<QuestionnaireResult[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadResults();
  }, [patientId]);

  const loadResults = async () => {
    try {
      // Buscar resultados concluídos (mesmo se estiverem pausados depois)
      const { data: progressData, error: progressError } = await supabase
        .from('patient_questionnaire_progress')
        .select(`
          questionnaire_id,
          questions_answered,
          total_questions,
          status,
          started_at,
          completed_at,
          questionnaires(name, code)
        `)
        .eq('patient_id', patientId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (progressError) throw progressError;

      if (!progressData || progressData.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Carregar configurações de ativação
      const { data: settingsData, error: settingsError } = await supabase
        .from('patient_questionnaire_settings')
        .select('questionnaire_id, is_active')
        .eq('patient_id', patientId);

      if (settingsError) {
        console.error('Erro ao buscar configurações de questionários:', settingsError);
      }

      const settingsMap = new Map<string, boolean>();
      settingsData?.forEach((s: { questionnaire_id: string; is_active: boolean }) => settingsMap.set(s.questionnaire_id, s.is_active));

      // Para cada questionário, buscar última resposta e calcular score
      const resultsWithScores = await Promise.all(
        progressData.map(async (progress) => {
          // Buscar última resposta
          const { data: lastResponse, error: responseError } = await supabase
            .from('questionnaire_responses')
            .select('answered_at')
            .eq('patient_id', patientId)
            .eq('questionnaire_id', progress.questionnaire_id)
            .order('answered_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (responseError) {
            console.error('Erro ao buscar última resposta:', responseError);
          }

          // Calcular score total se completado
          let totalScore = 0;
          let riskLevel = 'low';

          if (progress.status === 'completed') {
            const { data: responses, error: scoresError } = await supabase
              .from('questionnaire_responses')
              .select('response_value, answered_at, questionnaire_questions(risk_threshold)')
              .eq('patient_id', patientId)
              .eq('questionnaire_id', progress.questionnaire_id)
              .gte('answered_at', progress.started_at as string)
              .lte('answered_at', progress.completed_at as string);

            console.log('Respostas do questionário:', {
              questionnaireId: progress.questionnaire_id,
              responses,
              error: scoresError,
              started_at: progress.started_at,
              completed_at: progress.completed_at
            });

            if (!scoresError && responses && responses.length > 0) {
              totalScore = responses.reduce((sum, response) => sum + response.response_value, 0);
              
              console.log('Score calculado:', totalScore, 'para', progress.questionnaires?.code);
              
              // Determinar nível de risco baseado no código do questionário
              const questionnaireCode = progress.questionnaires?.code;
              
              if (questionnaireCode === 'PHQ9') {
                if (totalScore >= 20) riskLevel = 'high';
                else if (totalScore >= 15) riskLevel = 'moderate';
                else if (totalScore >= 10) riskLevel = 'mild';
                else riskLevel = 'low';
              } else if (questionnaireCode === 'GAD7') {
                if (totalScore >= 15) riskLevel = 'high';
                else if (totalScore >= 10) riskLevel = 'moderate';
                else if (totalScore >= 5) riskLevel = 'mild';
                else riskLevel = 'low';
              }
            } else {
              console.warn('Nenhuma resposta encontrada ou erro:', scoresError);
            }
          }

          const isActiveSetting = settingsMap.has(progress.questionnaire_id) ? settingsMap.get(progress.questionnaire_id) : undefined;
          const displayStatus = isActiveSetting === false && progress.status !== 'completed' ? 'paused' : progress.status;

          return {
            questionnaire_id: progress.questionnaire_id,
            questionnaire_name: progress.questionnaires?.name || 'Questionário',
            questionnaire_code: progress.questionnaires?.code || '',
            questions_answered: progress.questions_answered,
            total_questions: progress.total_questions,
            status: displayStatus,
            completed_at: progress.completed_at,
            last_response_date: lastResponse?.answered_at,
            total_score: progress.status === 'completed' ? totalScore : undefined,
            risk_level: progress.status === 'completed' ? riskLevel : undefined,
          };
        })
      );

      setResults(resultsWithScores);
    } catch (error) {
      console.error('Erro ao carregar resultados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar resultados dos questionários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`patient-qp-${patientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_questionnaire_progress', filter: `patient_id=eq.${patientId}` }, () => {
        loadResults();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_questionnaire_settings', filter: `patient_id=eq.${patientId}` }, () => {
        loadResults();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  const getRiskLevelBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return <Badge variant="destructive">Alto Risco</Badge>;
      case 'moderate':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Risco Moderado</Badge>;
      case 'mild':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Risco Leve</Badge>;
      default:
        return <Badge variant="secondary">Baixo Risco</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completo';
      case 'in_progress':
        return 'Em Andamento';
      case 'paused':
        return 'Pausado';
      default:
        return '—';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resultados dos Questionários</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nenhum questionário ativo encontrado para este paciente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados dos Questionários</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.map((result) => (
          <div key={result.questionnaire_id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{result.questionnaire_name}</h4>
              <div className="flex items-center gap-2">
                {getStatusIcon(result.status)}
                <span className="text-sm text-muted-foreground">
                  {getStatusText(result.status)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{result.questions_answered}/{result.total_questions}</span>
              </div>
              <Progress 
                value={(result.questions_answered / result.total_questions) * 100} 
                className="h-2"
              />
            </div>

            {result.status === 'completed' && (
              <div className="border-t pt-3 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Score Total: </span>
                    <span className="font-semibold text-lg">{result.total_score ?? 0}</span>
                  </div>
                  {result.risk_level && getRiskLevelBadge(result.risk_level)}
                </div>
              </div>
            )}

            {result.completed_at && (
              <p className="text-xs text-muted-foreground">
                Completo em: {format(new Date(result.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}

            {result.last_response_date && result.status !== 'completed' && (
              <p className="text-xs text-muted-foreground">
                Última resposta: {format(new Date(result.last_response_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}