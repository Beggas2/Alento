import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Calendar, 
  RefreshCw, 
  Copy, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Summary {
  id: string;
  period_start: string;
  period_end: string;
  sections_json: any;
  tokens_used: number;
  created_at: string;
  summary_type: string;
  status: string;
}

interface PatientSummariesProps {
  patientId: string;
}

export function PatientSummaries({ patientId }: PatientSummariesProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchSummaries();
  }, [patientId]);

  const fetchSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('patient_id', patientId)
        .order('period_end', { ascending: false });

      if (error) throw error;
      setSummaries(data || []);
    } catch (error) {
      console.error('Erro ao carregar resumos:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar resumos do paciente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (type: 'weekly' | 'monthly') => {
    if (generating) return;
    
    setGenerating(true);
    try {
      // Check monthly limit (1 summary per month per professional per patient)
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: existingSummaries, error: checkError } = await supabase
        .from('ai_summaries')
        .select('id')
        .eq('patient_id', patientId)
        .eq('generated_by', user.id)
        .gte('created_at', currentMonthStart.toISOString());

      if (checkError) throw checkError;

      if (existingSummaries && existingSummaries.length >= 1) {
        toast({
          title: 'Limite atingido',
          description: 'Você já gerou um resumo para este paciente neste mês. Aguarde o próximo mês ou faça upgrade do plano.',
          variant: 'destructive',
        });
        setGenerating(false);
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      
      if (type === 'weekly') {
        startDate.setDate(endDate.getDate() - 7);
      } else {
        startDate.setMonth(endDate.getMonth() - 1);
      }

      // Request summary generation
      const { data: summaryId, error: requestError } = await supabase
        .rpc('request_patient_summary', {
          p_patient_id: patientId,
          p_period_start: startDate.toISOString().split('T')[0],
          p_period_end: endDate.toISOString().split('T')[0],
          p_summary_type: type
        });

      if (requestError) throw requestError;

      // Call edge function to generate the summary
      const { data: result, error: generateError } = await supabase.functions.invoke(
        'generate-patient-summary',
        {
          body: { summaryId }
        }
      );

      if (generateError) throw generateError;

      if (result?.success) {
        toast({
          title: 'Resumo gerado com sucesso',
          description: `Resumo ${type === 'weekly' ? 'semanal' : 'mensal'} foi criado`,
        });
        fetchSummaries();
      } else {
        throw new Error(result?.error || 'Falha na geração do resumo');
      }
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao gerar resumo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: `Seção "${section}" copiada para a área de transferência`,
    });
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'timeline': return <Clock className="h-4 w-4" />;
      case 'key_changes': return <TrendingUp className="h-4 w-4" />;
      case 'red_flags': return <AlertTriangle className="h-4 w-4" />;
      case 'adherence': return <Activity className="h-4 w-4" />;
      case 'next_steps': return <Calendar className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSectionTitle = (section: string) => {
    const titles = {
      timeline: 'Cronologia',
      key_changes: 'Principais Mudanças',
      red_flags: 'Sinais de Alerta',
      adherence: 'Aderência',
      next_steps: 'Próximos Passos'
    };
    return titles[section as keyof typeof titles] || section;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Carregando resumos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate Summary Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => generateSummary('weekly')}
          disabled={generating}
          size="sm"
          variant="outline"
        >
          {generating ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Gerar Resumo Semanal
        </Button>
        <Button
          onClick={() => generateSummary('monthly')}
          disabled={generating}
          size="sm"
          variant="outline"
        >
          {generating ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Gerar Resumo Mensal
        </Button>
      </div>

      {/* Summaries List */}
      {summaries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum resumo gerado ainda. Clique nos botões acima para gerar o primeiro resumo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <Card key={summary.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      Resumo {summary.summary_type === 'weekly' ? 'Semanal' : 'Mensal'}
                    </CardTitle>
                    <Badge variant={summary.status === 'completed' ? 'default' : 'secondary'}>
                      {summary.status === 'completed' ? 'Concluído' : 'Processando'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(summary.period_start), 'dd/MM', { locale: ptBR })} - {' '}
                    {format(new Date(summary.period_end), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                </div>
              </CardHeader>
              
              {summary.status === 'completed' && summary.sections_json && (
                <CardContent>
                  <Collapsible
                    open={expandedSummary === summary.id}
                    onOpenChange={(open) => setExpandedSummary(open ? summary.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0">
                        <span>Ver detalhes do resumo</span>
                        {expandedSummary === summary.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="space-y-4 mt-4">
                      <Tabs defaultValue="timeline" className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                          {Object.keys(summary.sections_json).map((section) => (
                            <TabsTrigger key={section} value={section} className="text-xs">
                              {getSectionIcon(section)}
                              <span className="ml-1 hidden sm:inline">
                                {getSectionTitle(section)}
                              </span>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {Object.entries(summary.sections_json).map(([section, content]) => (
                          <TabsContent key={section} value={section} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold flex items-center gap-2">
                                {getSectionIcon(section)}
                                {getSectionTitle(section)}
                              </h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(String(content) || '', getSectionTitle(section))}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {String(content) || 'Nenhum conteúdo disponível para esta seção'}
                              </p>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>
                          Tokens utilizados: {summary.tokens_used}
                        </span>
                        <span>
                          Gerado em: {format(new Date(summary.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}