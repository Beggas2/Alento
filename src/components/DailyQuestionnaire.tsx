import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Question {
  id: string;
  questionnaire_id: string;
  question_number: number;
  question_text: string;
  options: any;
  risk_threshold?: number | null;
}

interface QuestionnaireInfo {
  id: string;
  name: string;
  code: string;
}

interface QuestionProgress {
  questionnaire_id: string;
  questionnaire_name: string;
  questions_answered: number;
  total_questions: number;
}

interface DailyQuestionnaireProps {
  patientId: string;
  onResponsesSubmit?: (hasRiskAlerts: boolean) => void;
}

export function DailyQuestionnaire({ patientId, onResponsesSubmit }: DailyQuestionnaireProps) {
  const [questions, setQuestions] = useState<(Question & { questionnaire_name: string })[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<QuestionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noQuestionsReason, setNoQuestionsReason] = useState<'limit' | 'none' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTodaysQuestions();
    loadProgress();
  }, [patientId]);

  const loadTodaysQuestions = async () => {
    try {
      // Buscar questionários ativos para este paciente
      const { data: activeSettings, error: settingsError } = await supabase
        .from('patient_questionnaire_settings')
        .select(`
          questionnaire_id,
          questionnaires(id, name, code, total_questions)
        `)
        .eq('patient_id', patientId)
        .eq('is_active', true);

      if (settingsError) throw settingsError;

      // Verificar se existem quaisquer configurações (mesmo desativadas)
      const { count: settingsCount, error: countError } = await supabase
        .from('patient_questionnaire_settings')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId);

      if (countError) throw countError;

      // Lista baseada apenas em configurações explícitas (não auto-ativar por padrão)
      let activeList = activeSettings ? [...activeSettings] : [];
      const hasAnySettings = (settingsCount ?? 0) > 0;

      // Se não houver configurações ativas, não mostrar questionários
      if (!activeList || activeList.length === 0) {
        setNoQuestionsReason('none');
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Remover questionários duplicados por questionnaire_id
      activeList = Array.from(new Map(activeList.map((s: any) => [s.questionnaire_id, s])).values());

      // Se há configurações (mesmo que todas desativadas) e nenhuma ativa, não mostrar questionários
      if (!activeList || activeList.length === 0) {
        setNoQuestionsReason('none');
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Buscar progresso atual
      let { data: progressData, error: progressError } = await supabase
        .from('patient_questionnaire_progress')
        .select('*')
        .eq('patient_id', patientId)
        .in('questionnaire_id', activeList.map(s => s.questionnaire_id))
        .neq('status', 'completed');

      if (progressError) throw progressError;

      // Garantir progresso para questionários ativos sem progresso
      const missing = activeList.filter(s => !(progressData || []).some(p => p.questionnaire_id === s.questionnaire_id));
      for (const s of missing) {
        const total = s.questionnaires?.total_questions || 0;
        const { error: upsertMissingError } = await supabase
          .from('patient_questionnaire_progress')
          .upsert(
            {
              patient_id: patientId,
              questionnaire_id: s.questionnaire_id,
              total_questions: total,
              current_question: 1,
              questions_answered: 0,
              status: 'in_progress'
            },
            { onConflict: 'patient_id,questionnaire_id', ignoreDuplicates: true }
          );
        if (upsertMissingError && !upsertMissingError.message?.includes('duplicate')) {
          console.error('Erro ao criar progresso ausente:', upsertMissingError);
        }
      }

      if (missing.length > 0) {
        const { data: refreshed, error: refreshError } = await supabase
          .from('patient_questionnaire_progress')
          .select('*')
          .eq('patient_id', patientId)
          .in('questionnaire_id', activeList.map(s => s.questionnaire_id))
          .neq('status', 'completed');
        if (!refreshError) {
          progressData = refreshed;
        }
      }

      // Verificar quantas perguntas já foram respondidas hoje
      const today = new Date().toISOString().split('T')[0];
      const { data: todayResponses, error: responsesError } = await supabase
        .from('questionnaire_responses')
        .select('question_id')
        .eq('patient_id', patientId)
        .gte('answered_at', `${today}T00:00:00Z`)
        .lt('answered_at', `${today}T23:59:59Z`);

      if (responsesError) throw responsesError;

      const todayQuestionIds = new Set(todayResponses?.map(r => r.question_id) || []);
      const maxQuestionsPerDay = 3;
      
       if (todayQuestionIds.size >= maxQuestionsPerDay) {
         setNoQuestionsReason('limit');
         setQuestions([]);
         setLoading(false);
         return;
       }

      // Buscar próximas perguntas a responder
      const questionsToFetch = [];
      for (const setting of activeList) {
        const prog = progressData?.find(p => p.questionnaire_id === setting.questionnaire_id);
        if (prog && prog.current_question <= prog.total_questions) {
          questionsToFetch.push({
            questionnaire_id: setting.questionnaire_id,
            question_number: prog.current_question,
            questionnaire_name: setting.questionnaires?.name || ''
          });
        }
      }

      // Limitar a 3 perguntas por dia
      const questionsForToday = questionsToFetch.slice(0, maxQuestionsPerDay - todayQuestionIds.size);

       if (questionsForToday.length === 0) {
         setNoQuestionsReason('none');
         setQuestions([]);
         setLoading(false);
         return;
       }

      // Buscar as perguntas específicas
      const questionsPromises = questionsForToday.map(async (q) => {
        const { data: questionData, error: questionError } = await supabase
          .from('questionnaire_questions')
          .select('*')
          .eq('questionnaire_id', q.questionnaire_id)
          .eq('question_number', q.question_number)
          .maybeSingle();

        if (questionError) {
          console.warn('Pergunta não encontrada ou erro ao buscar:', q, questionError);
          return null;
        }

        if (!questionData) return null;

        return {
          ...questionData,
          questionnaire_name: q.questionnaire_name,
          options: Array.isArray(questionData.options) ? questionData.options : JSON.parse(String(questionData.options))
        };
      });

      const questionsData = (await Promise.all(questionsPromises)).filter(Boolean) as (Question & { questionnaire_name: string })[];

      // Remover perguntas duplicadas por ID (evita RadioGroups sincronizados)
      const uniqueQuestions = Array.from(new Map(questionsData.map((q) => [q.id, q])).values());

       if (uniqueQuestions.length === 0) {
         setNoQuestionsReason('none');
         setQuestions([]);
         setLoading(false);
         return;
       }
 
       setQuestions(uniqueQuestions);
    } catch (error) {
      console.error('Erro ao carregar perguntas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar perguntas do dia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const { data: progressData, error: progressError } = await supabase
        .from('patient_questionnaire_progress')
        .select(`
          questionnaire_id,
          questions_answered,
          total_questions,
          questionnaires(name)
        `)
        .eq('patient_id', patientId);

      if (progressError) throw progressError;

      const progressInfo = progressData?.map(p => ({
        questionnaire_id: p.questionnaire_id,
        questionnaire_name: p.questionnaires?.name || '',
        questions_answered: p.questions_answered,
        total_questions: p.total_questions
      })) || [];

      setProgress(progressInfo);
    } catch (error) {
      console.error('Erro ao carregar progresso:', error);
    }
  };

  const handleResponseChange = (questionId: string, value: number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(responses).length !== questions.length) {
      toast({
        title: "Atenção",
        description: "Por favor, responda todas as perguntas",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    let hasRiskAlerts = false;

    try {
      // Salvar respostas
      for (const question of questions) {
        const responseValue = responses[question.id];
        
        // Verificar se há risco
        if (question.risk_threshold && responseValue >= question.risk_threshold) {
          hasRiskAlerts = true;
        }

        const { error: responseError } = await supabase
          .from('questionnaire_responses')
          .insert({
            patient_id: patientId,
            questionnaire_id: question.questionnaire_id,
            question_id: question.id,
            question_number: question.question_number,
            response_value: responseValue,
            response_text: question.options[responseValue]
          });

        if (responseError) throw responseError;

        // Atualizar progresso
        const { data: currentProgress, error: progressError } = await supabase
          .from('patient_questionnaire_progress')
          .select('*')
          .eq('patient_id', patientId)
          .eq('questionnaire_id', question.questionnaire_id)
          .single();

        if (progressError) throw progressError;

        const newQuestionsAnswered = currentProgress.questions_answered + 1;
        const newCurrentQuestion = currentProgress.current_question + 1;
        const isCompleted = newQuestionsAnswered >= currentProgress.total_questions;

        const updateData: any = {
          questions_answered: newQuestionsAnswered,
          current_question: newCurrentQuestion,
        };

        if (isCompleted) {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
          updateData.next_cycle_date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 2 semanas
        }

        const { error: updateError } = await supabase
          .from('patient_questionnaire_progress')
          .update(updateData)
          .eq('id', currentProgress.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Sucesso",
        description: "Respostas enviadas com sucesso",
      });

      // Limpar formulário e recarregar
      setResponses({});
      loadTodaysQuestions();
      loadProgress();
      
      onResponsesSubmit?.(hasRiskAlerts);
    } catch (error) {
      console.error('Erro ao enviar respostas:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar respostas",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="shadow-md border-l-4 border-l-secondary">
        <CardHeader>
          <CardTitle className="text-lg">Perguntas do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {noQuestionsReason === 'limit'
              ? 'Você já respondeu todas as perguntas de hoje. Volte amanhã para continuar!'
              : 'Não há perguntas disponíveis para hoje.'}
          </p>
          {progress.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-semibold text-base">Seu Progresso:</h4>
              {progress.map((prog) => {
                const percentage = (prog.questions_answered / prog.total_questions) * 100;
                const remaining = prog.total_questions - prog.questions_answered;
                const estimatedMinutes = remaining * 0.5;
                return (
                  <div key={prog.questionnaire_id} className="space-y-2 p-3 bg-secondary/5 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{prog.questionnaire_name}</span>
                      <span className="text-2xl font-bold text-primary">{Math.round(percentage)}%</span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-3"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{prog.questions_answered} de {prog.total_questions} perguntas</span>
                      {remaining > 0 && (
                        <span>Faltam ~{Math.ceil(estimatedMinutes)} min</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="text-lg">Questionário Diário</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          {questions.length === 1 
            ? 'Responda a pergunta de hoje' 
            : `${questions.length} perguntas para hoje`}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-3 p-4 bg-background/50 rounded-lg border">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-primary text-primary-foreground rounded-full text-sm flex items-center justify-center font-semibold">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  {question.questionnaire_name}
                </p>
                <p className="font-medium mb-4 text-base">
                  {question.question_text}
                </p>
                <RadioGroup
                  name={`q-${question.id}-${index}`}
                  value={responses[question.id]?.toString()}
                  onValueChange={(value) => handleResponseChange(question.id, parseInt(value))}
                  className="space-y-3"
                >
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-3 p-3 bg-background rounded-md hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={optionIndex.toString()} id={`${question.id}-${index}-${optionIndex}`} />
                      <Label htmlFor={`${question.id}-${index}-${optionIndex}`} className="text-sm font-normal cursor-pointer flex-1">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>
        ))}

        {progress.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-base">Progresso Geral:</h4>
            {progress.map((prog) => {
              const percentage = (prog.questions_answered / prog.total_questions) * 100;
              const remaining = prog.total_questions - prog.questions_answered;
              const estimatedMinutes = remaining * 0.5;
              return (
                <div key={prog.questionnaire_id} className="space-y-2 p-3 bg-secondary/5 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{prog.questionnaire_name}</span>
                    <span className="text-xl font-bold text-primary">{Math.round(percentage)}%</span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{prog.questions_answered} de {prog.total_questions} respondidas</span>
                    {remaining > 0 && (
                      <span>Faltam ~{Math.ceil(estimatedMinutes)} min para completar</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button 
          onClick={handleSubmit} 
          disabled={submitting || Object.keys(responses).length !== questions.length}
          className="w-full h-12 text-base font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Enviando suas respostas...
            </>
          ) : (
            Object.keys(responses).length === questions.length 
              ? 'Enviar Respostas' 
              : `Responda ${questions.length - Object.keys(responses).length} pergunta(s)`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}