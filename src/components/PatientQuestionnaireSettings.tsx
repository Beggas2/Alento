import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Lock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Questionnaire {
  id: string;
  name: string;
  code: string;
  description: string;
  total_questions: number;
  active_by_default: boolean;
}

interface QuestionnaireProgress {
  questionnaire_id: string;
  questions_answered: number;
  total_questions: number;
  status: string;
  completed_at?: string;
}

interface QuestionnaireSetting {
  id?: string;
  questionnaire_id: string;
  is_active: boolean;
  professional_id?: string;
}

interface PatientQuestionnaireSettingsProps {
  patientId: string;
  professionalId: string;
}

export function PatientQuestionnaireSettings({ patientId, professionalId }: PatientQuestionnaireSettingsProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [settings, setSettings] = useState<QuestionnaireSetting[]>([]);
  const [progress, setProgress] = useState<QuestionnaireProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [patientId, professionalId]);

  const loadData = async () => {
    try {
      // Carregar questionários disponíveis
      const { data: questionnairesData, error: questionnairesError } = await supabase
        .from('questionnaires')
        .select('*')
        .order('name');

      if (questionnairesError) throw questionnairesError;

      // Carregar todas as configurações (não só do profissional atual)
      const { data: settingsData, error: settingsError } = await supabase
        .from('patient_questionnaire_settings')
        .select('id, questionnaire_id, is_active, professional_id')
        .eq('patient_id', patientId);

      if (settingsError) throw settingsError;

      // Carregar progresso dos questionários
      const { data: progressData, error: progressError } = await supabase
        .from('patient_questionnaire_progress')
        .select('questionnaire_id, questions_answered, total_questions, status, completed_at')
        .eq('patient_id', patientId);

      if (progressError) throw progressError;

      setQuestionnaires(questionnairesData || []);
      setSettings(settingsData || []);
      setProgress(progressData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações dos questionários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchChange = (questionnaireId: string, isActive: boolean) => {
    setSettings(prev => {
      const existing = prev.find(s => s.questionnaire_id === questionnaireId && s.professional_id === professionalId);
      if (existing) {
        return prev.map(s => 
          s.questionnaire_id === questionnaireId && s.professional_id === professionalId
            ? { ...s, is_active: isActive }
            : s
        );
      } else {
        return [...prev, { 
          questionnaire_id: questionnaireId, 
          is_active: isActive,
          professional_id: professionalId
        }];
      }
    });
  };

  const handleDeleteProgress = async (questionnaireId: string) => {
    try {
      // Zerar: arquivar TODOS os progressos não concluídos
      await supabase
        .from('patient_questionnaire_progress')
        .update({
          status: 'archived',
          questions_answered: 0,
          current_question: 1,
          completed_at: null,
          next_cycle_date: null,
        })
        .eq('patient_id', patientId)
        .eq('questionnaire_id', questionnaireId)
        .neq('status', 'completed');

      // Desativar para o profissional atual
      await supabase
        .from('patient_questionnaire_settings')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('questionnaire_id', questionnaireId)
        .eq('professional_id', professionalId);

      await loadData();
      
      toast({
        title: "Sucesso",
        description: "Progresso zerado. Resultados completos foram mantidos.",
      });
    } catch (error) {
      console.error('Erro ao arquivar progresso:', error);
      toast({
        title: "Erro",
        description: "Não foi possível zerar o progresso.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvar apenas configurações do profissional atual
      const currentProfessionalSettings = settings.filter(s => s.professional_id === professionalId);
      
      for (const setting of currentProfessionalSettings) {
        const { error } = await supabase
          .from('patient_questionnaire_settings')
          .upsert({
            patient_id: patientId,
            professional_id: professionalId,
            questionnaire_id: setting.questionnaire_id,
            is_active: setting.is_active,
            activated_at: setting.is_active ? new Date().toISOString() : undefined,
            deactivated_at: !setting.is_active ? new Date().toISOString() : undefined,
          }, {
            onConflict: 'patient_id,professional_id,questionnaire_id'
          });

        if (error) throw error;

        // Se ativado, criar progresso; se desativado, arquivar
        if (setting.is_active) {
          const questionnaire = questionnaires.find(q => q.id === setting.questionnaire_id);
          if (questionnaire) {
            // Verificar se já existe progresso em andamento
            const existingProgress = progress.find(p => 
              p.questionnaire_id === setting.questionnaire_id && p.status === 'in_progress'
            );
            
            if (!existingProgress) {
              // Criar novo progresso
              await supabase
                .from('patient_questionnaire_progress')
                .insert({
                  patient_id: patientId,
                  questionnaire_id: setting.questionnaire_id,
                  total_questions: questionnaire.total_questions,
                  current_question: 1,
                  questions_answered: 0,
                  status: 'in_progress'
                });
            }
          }
        } else {
          // Arquivar progresso não concluído (mantém apenas completos)
          await supabase
            .from('patient_questionnaire_progress')
            .update({ status: 'archived' })
            .eq('patient_id', patientId)
            .eq('questionnaire_id', setting.questionnaire_id)
            .neq('status', 'completed');
        }
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });

      loadData();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canManage = (questionnaireId: string): boolean => {
    // Pode gerenciar se não tem configuração ou se a configuração é do profissional atual
    const setting = settings.find(s => s.questionnaire_id === questionnaireId && s.is_active);
    return !setting || setting.professional_id === professionalId;
  };

  const isActive = (questionnaireId: string) => {
    // Verifica se há alguma configuração ativa para este questionário
    const activeSetting = settings.find(s => s.questionnaire_id === questionnaireId && s.is_active);
    return !!activeSetting;
  };

  const isActiveByCurrentProfessional = (questionnaireId: string) => {
    // Verifica se o profissional atual ativou este questionário
    const setting = settings.find(s => 
      s.questionnaire_id === questionnaireId && 
      s.professional_id === professionalId
    );
    return setting?.is_active || false;
  };

  const getProgressInfo = (questionnaireId: string) => {
    const progs = progress.filter(p => p.questionnaire_id === questionnaireId);
    if (progs.length === 0) return null;

    // Prioridade: em andamento > completo > ignorar arquivado
    const active = progs.find(p => p.status === 'in_progress');
    if (active) {
      return `${active.questions_answered}/${active.total_questions} respondidas`;
    }

    const completed = progs.find(p => p.status === 'completed' && p.completed_at);
    if (completed) {
      const completedDate = new Date(completed.completed_at!).toLocaleDateString('pt-BR');
      return `Completo (${completedDate})`;
    }

    return null;
  };

  const getActivatedBy = (questionnaireId: string): string | null => {
    const activeSetting = settings.find(s => s.questionnaire_id === questionnaireId && s.is_active);
    if (!activeSetting) return null;
    
    return activeSetting.professional_id === professionalId ? 'Você' : 'Outro profissional';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escalas e Questionários</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionnaires.map((questionnaire) => {
          const active = isActive(questionnaire.id);
          const activeByMe = isActiveByCurrentProfessional(questionnaire.id);
          const progressInfo = getProgressInfo(questionnaire.id);
          const activatedBy = getActivatedBy(questionnaire.id);
          const canEdit = canManage(questionnaire.id);
          const hasProgress = progress.some(p => p.questionnaire_id === questionnaire.id && p.status === 'in_progress');

          return (
            <div key={questionnaire.id} className="flex flex-col space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{questionnaire.name}</h4>
                    {!canEdit && <Lock className="h-4 w-4 text-gray-400" />}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {questionnaire.description}
                  </p>
                  {progressInfo && (
                    <Badge variant="secondary" className="text-xs mb-2">
                      {progressInfo}
                    </Badge>
                  )}
                  {activatedBy && (
                    <p className="text-xs text-muted-foreground">
                      Ativado por: {activatedBy}
                    </p>
                  )}
                  {!canEdit && (
                    <p className="text-xs text-amber-600">
                      Apenas quem ativou pode desativar
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasProgress && canEdit && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Zerar Progresso</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja zerar o progresso do questionário "{questionnaire.name}"? 
                            Todas as respostas em andamento serão descartadas. Resultados completos serão mantidos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteProgress(questionnaire.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Zerar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Switch
                    checked={activeByMe}
                    onCheckedChange={(checked) => handleSwitchChange(questionnaire.id, checked)}
                    disabled={!canEdit && !activeByMe}
                    aria-label={`Ativar/desativar questionário`}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}