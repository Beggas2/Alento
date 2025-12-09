import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, FileText, Edit, Moon, TrendingUp } from 'lucide-react';
import MoodEditor from '@/components/MoodEditor';
import RecordDetailsEditor from '@/components/RecordDetailsEditor';
import { DailyQuestionnaire } from '@/components/DailyQuestionnaire';
import QuickRecordForm from '@/components/QuickRecordForm';
import StreakDisplay from '@/components/StreakDisplay';
import InsightsCard from '@/components/InsightsCard';
import { useStreakCalculation } from '@/hooks/useStreakCalculation';
import { useRecordInsights } from '@/hooks/useRecordInsights';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyRecord {
  id: string;
  patient_id: string;
  como_se_sentiu: string | null;
  data: string;
  gatilhos: string | null;
  humor: string;
  observacoes_profissional: string | null;
  sinal_alerta: boolean | null;
  created_at: string;
  updated_at: string;
  sleep_hours?: number;
  energia?: number;
}

const Registros = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  const streakData = useStreakCalculation(records);
  const insights = useRecordInsights(records);

  useEffect(() => {
    if (profile) {
      fetchRecords();
    }
  }, [profile]);

  const fetchRecords = async () => {
    try {
      // Buscar paciente associado ao perfil do usuário
      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile?.user_id)
        .single();

      // Se o paciente não existir, criar um novo registro
      if (!patient) {
        const { data: newPatient, error: createError } = await supabase
          .from('patients')
          .insert({
            user_id: profile?.user_id,
            profissional_id: null
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Erro ao criar paciente:', createError);
          setRecords([]);
          setLoading(false);
          return;
        }
        
        patient = newPatient;
      }

      const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
      setPatientId(patient.id);
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

  const handleSubmit = async (data: {
    humor: number;
    energia: number;
    sleep_hours: number;
    como_se_sentiu: string;
    gatilhos: string;
  }) => {
    if (!profile) return;

    try {
      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', profile.user_id)
        .single();

      if (!patient) {
        const { data: newPatient, error: createError } = await supabase
          .from('patients')
          .insert({
            user_id: profile.user_id,
            profissional_id: null
          })
          .select('id')
          .single();

        if (createError) {
          toast({
            title: "Erro",
            description: "Erro ao criar registro do paciente.",
            variant: "destructive"
          });
          return;
        }
        
        patient = newPatient;
      }

      const { data: newRecord, error } = await supabase
        .from('daily_records')
        .insert({
          patient_id: patient.id,
          humor: data.humor.toString() as any,
          energia: data.energia,
          como_se_sentiu: data.como_se_sentiu,
          gatilhos: data.gatilhos,
          sleep_hours: data.sleep_hours,
          data: new Date().toISOString().split('T')[0],
          sinal_alerta: false
        })
        .select()
        .single();

      if (error) throw error;

      if (newRecord && (data.como_se_sentiu || data.gatilhos)) {
        try {
          const textToAnalyze = `${data.como_se_sentiu} ${data.gatilhos}`.trim();
          
          const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-record-alerts', {
            body: {
              recordId: newRecord.id,
              patientText: textToAnalyze,
              patientId: patient.id
            }
          });

          if (analysisError) {
            console.error('Erro na análise de alertas:', analysisError);
          } else if (analysisResult?.alertCreated) {
            toast({
              title: "Análise de segurança concluída",
              description: "Seu registro foi analisado para garantir seu bem-estar.",
            });
          }
        } catch (analysisError) {
          console.error('Erro ao processar análise:', analysisError);
        }
      }

      // Feedback com gamificação
      const message = streakData.currentStreak > 0 
        ? `Você manteve estabilidade ${streakData.currentStreak} dias seguidos!`
        : "Primeiro passo dado! Continue assim.";

      toast({
        title: "Registro salvo!",
        description: message
      });

      setShowForm(false);
      fetchRecords();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar registro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getMoodColor = (level: number) => {
    if (level <= 3) return 'text-health-danger';
    if (level <= 6) return 'text-health-warning';
    return 'text-health-success';
  };

  const getMoodLabel = (level: number) => {
    if (level <= 2) return 'Muito baixo';
    if (level <= 4) return 'Baixo';
    if (level <= 6) return 'Neutro';
    if (level <= 8) return 'Bom';
    return 'Excelente';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Meus Registros</h2>
            </div>
          </div>
        </header>
        <div className="p-6 text-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <SidebarTrigger />
          <div className="ml-4 flex-1">
            <h2 className="font-semibold text-foreground">Meus Registros</h2>
          </div>
          <Button onClick={() => setShowForm(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" />
            Novo Registro
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* 1. Formulário de Registro Rápido */}
        {showForm && (
          <QuickRecordForm 
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* 2. Questionários Diários */}
        {patientId && (
          <DailyQuestionnaire 
            patientId={patientId}
            onResponsesSubmit={(hasRiskAlerts) => {
              if (hasRiskAlerts) {
                toast({
                  title: "Análise de respostas",
                  description: "Suas respostas foram analisadas e podem gerar um alerta para seu profissional.",
                });
              }
              fetchRecords();
            }}
          />
        )}

        {/* 3. Insights Automáticos */}
        {insights.length > 0 && <InsightsCard insights={insights} />}

        {/* 4. Progresso e Gamificação */}
        {records.length > 0 && (
          <StreakDisplay 
            currentStreak={streakData.currentStreak}
            weekProgress={streakData.weekProgress}
            totalRecords={records.length}
          />
        )}

        {/* 5. Histórico de Registros */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Histórico de Registros
            </h3>
            <span className="text-sm text-muted-foreground">{records.length} registros</span>
          </div>
          
          {records.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Nenhum registro encontrado</p>
                <p className="text-sm text-muted-foreground">Comece fazendo seu primeiro registro!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <Card key={record.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(record.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingRecord(editingRecord === record.id ? null : record.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {editingRecord === record.id ? (
                      <div className="space-y-4 mb-4">
                        <MoodEditor
                          recordId={record.id}
                          currentMood={parseInt(record.humor)}
                          onUpdate={() => {
                            fetchRecords();
                            setEditingRecord(null);
                          }}
                          isEditing={true}
                          onToggleEdit={() => setEditingRecord(null)}
                        />
                        <RecordDetailsEditor
                          recordId={record.id}
                          patientId={record.patient_id}
                          initialEnergia={record.energia ?? undefined}
                          initialSleepHours={record.sleep_hours ?? undefined}
                          initialComoSeSentiu={record.como_se_sentiu ?? undefined}
                          initialGatilhos={record.gatilhos ?? undefined}
                          onSaved={() => {
                            fetchRecords();
                            setEditingRecord(null);
                          }}
                          onCancel={() => setEditingRecord(null)}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Humor</div>
                          <div className={`text-2xl font-bold ${getMoodColor(parseInt(record.humor))}`}>
                            {record.humor}/10
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getMoodLabel(parseInt(record.humor))}
                          </div>
                        </div>

                        {record.energia && (
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Energia</div>
                            <div className={`text-2xl font-bold ${getMoodColor(record.energia)}`}>
                              {record.energia}/10
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getMoodLabel(record.energia)}
                            </div>
                          </div>
                        )}
                        
                        {record.sleep_hours && (
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Sono</div>
                            <div className="text-2xl font-bold text-primary">
                              {record.sleep_hours}h
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Moon className="h-3 w-3" />
                              horas dormidas
                            </div>
                          </div>
                        )}
                        
                        {record.sinal_alerta && (
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Status</div>
                            <div className="text-2xl font-bold text-health-danger">
                              ⚠️ Alerta
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {record.como_se_sentiu && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Como se sentiu:</div>
                        <div className="text-sm">{record.como_se_sentiu}</div>
                      </div>
                    )}

                    {record.gatilhos && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Gatilhos:</div>
                        <div className="text-sm">{record.gatilhos}</div>
                      </div>
                    )}

                    {record.observacoes_profissional && (
                      <div className="mt-4 p-3 bg-health-primary/10 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Observações do Profissional:</div>
                        <div className="text-sm">{record.observacoes_profissional}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Registros;