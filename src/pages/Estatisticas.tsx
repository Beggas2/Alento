import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Heart,
  Zap,
  Moon,
  AlertTriangle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MultiPatientAnalytics from '@/components/MultiPatientAnalytics';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyRecord {
  id: string;
  patient_id: string;
  como_se_sentiu: string | null;
  data: string;
  gatilhos: string | null;
  humor: string;
  energia: number | null;
  sleep_hours: number | null;
  observacoes_profissional: string | null;
  sinal_alerta: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ChartData {
  date: string;
  humor: number;
  energia: number;
  sono: number;
}

const Estatisticas = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (profile) {
      if (profile.tipo === 'profissional') {
        fetchPatients();
      } else {
        fetchRecords();
      }
    }
  }, [profile, period]);

  useEffect(() => {
    if (selectedPatient && profile?.tipo === 'profissional') {
      fetchRecords();
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    try {
      // Buscar pacientes vinculados através da nova estrutura
      const { data: linkedPatients, error } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients(
            id,
            user_id
          )
        `)
        .eq('professional_id', profile?.id)
        .eq('status', 'active');

      if (error) throw error;

      if (linkedPatients && linkedPatients.length > 0) {
        const userIds = linkedPatients
          .map(link => link.patients?.user_id)
          .filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, nome')
            .in('user_id', userIds);

          if (profilesError) throw profilesError;

          const formattedPatients = linkedPatients.map(link => {
            if (!link.patients) return null;
            const profile = profilesData?.find(p => p.user_id === link.patients?.user_id);
            return profile ? {
              id: link.patients.id,
              nome: profile.nome
            } : null;
          }).filter(Boolean);

          setPatients(formattedPatients);
          
          if (formattedPatients.length > 0 && !selectedPatient) {
            setSelectedPatient(formattedPatients[0].id);
          }
        } else {
          setPatients([]);
        }
      } else {
        setPatients([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar pacientes",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchRecords = async () => {
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      let query = supabase
        .from('daily_records')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Se for paciente, buscar apenas seus registros
      if (profile?.tipo === 'paciente') {
        // Buscar paciente associado ao perfil
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();
        
        if (patient) {
          query = query.eq('patient_id', patient.id);
        } else {
          setRecords([]);
          setChartData([]);
          setLoading(false);
          return;
        }
      } else if (profile?.tipo === 'profissional' && selectedPatient) {
        // Se for profissional, buscar registros do paciente selecionado
        query = query.eq('patient_id', selectedPatient);
      } else if (profile?.tipo === 'profissional' && !selectedPatient) {
        // Se não tem paciente selecionado, não mostrar dados
        setRecords([]);
        setChartData([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      setRecords(data || []);
      processChartData(data || [], days);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estatísticas",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: DailyRecord[], days: number) => {
    const dateRange = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date()
    });

    const chartData = dateRange.map(date => {
      const dayRecords = data.filter(record => 
        format(new Date(record.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );

      const avgMood = dayRecords.length > 0 
        ? dayRecords.reduce((sum, record) => sum + parseInt(record.humor), 0) / dayRecords.length 
        : 0;

      const avgEnergia = dayRecords.length > 0 
        ? dayRecords.reduce((sum, record) => sum + (record.energia || 0), 0) / dayRecords.length 
        : 0;

      const avgSono = dayRecords.length > 0 
        ? dayRecords.reduce((sum, record) => sum + (record.sleep_hours || 0), 0) / dayRecords.length 
        : 0;

      return {
        date: format(date, 'dd/MM'),
        humor: Number(avgMood.toFixed(1)),
        energia: Number(avgEnergia.toFixed(1)),
        sono: Number(avgSono.toFixed(1))
      };
    });

    setChartData(chartData);
  };

  const calculateStats = () => {
    if (records.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        avgSleep: 0,
        moodTrend: 0,
        energyTrend: 0,
        sleepTrend: 0,
        totalRecords: 0,
        streakDays: 0
      };
    }

    const avgMood = records.length > 0 
      ? records.slice(-5).reduce((sum, record) => sum + parseInt(record.humor), 0) / Math.min(records.length, 5)
      : 0;
    const avgEnergy = records.length > 0 
      ? records.slice(-5).reduce((sum, record) => sum + (record.energia || 0), 0) / Math.min(records.length, 5)
      : 0;
    const avgSleep = records.length > 0 
      ? records.slice(-5).reduce((sum, record) => sum + (record.sleep_hours || 0), 0) / Math.min(records.length, 5)
      : 0;

    // Calcular tendências (últimos 7 dias vs 7 dias anteriores)
    const recentRecords = records.slice(-7);
    const previousRecords = records.slice(-14, -7);

    const recentMood = recentRecords.length > 0 
      ? recentRecords.reduce((sum, record) => sum + parseInt(record.humor), 0) / recentRecords.length 
      : 0;
    const previousMood = previousRecords.length > 0 
      ? previousRecords.reduce((sum, record) => sum + parseInt(record.humor), 0) / previousRecords.length 
      : 0;

    const recentEnergy = recentRecords.length > 0 
      ? recentRecords.reduce((sum, record) => sum + (record.energia || 0), 0) / recentRecords.length 
      : 0;
    const previousEnergy = previousRecords.length > 0 
      ? previousRecords.reduce((sum, record) => sum + (record.energia || 0), 0) / previousRecords.length 
      : 0;

    const recentSleep = recentRecords.length > 0 
      ? recentRecords.reduce((sum, record) => sum + (record.sleep_hours || 0), 0) / recentRecords.length 
      : 0;
    const previousSleep = previousRecords.length > 0 
      ? previousRecords.reduce((sum, record) => sum + (record.sleep_hours || 0), 0) / previousRecords.length 
      : 0;

    return {
      avgMood: Number(avgMood.toFixed(1)),
      avgEnergy: Number(avgEnergy.toFixed(1)),
      avgSleep: Number(avgSleep.toFixed(1)),
      moodTrend: Number((recentMood - previousMood).toFixed(1)),
      energyTrend: Number((recentEnergy - previousEnergy).toFixed(1)),
      sleepTrend: Number((recentSleep - previousSleep).toFixed(1)),
      totalRecords: records.length,
      streakDays: calculateStreakDays()
    };
  };

  const calculateStreakDays = () => {
    // Calcular sequência de dias com registros
    const today = new Date();
    let streak = 0;
    
    for (let i = 0; i < 30; i++) {
      const checkDate = subDays(today, i);
      const hasRecord = records.some(record => 
        format(new Date(record.created_at), 'yyyy-MM-dd') === format(checkDate, 'yyyy-MM-dd')
      );
      
      if (hasRecord) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-health-success" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-health-danger" />;
    return <div className="h-4 w-4" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-health-success';
    if (trend < 0) return 'text-health-danger';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Estatísticas</h2>
            </div>
          </div>
        </header>
        <div className="p-6 text-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <SidebarTrigger />
          <div className="ml-4 flex-1">
            <h2 className="font-semibold text-foreground">Estatísticas</h2>
            {profile?.tipo === 'profissional' && selectedPatient && (
              <p className="text-xs text-muted-foreground">
                Paciente: {patients.find(p => p.id === selectedPatient)?.nome}
              </p>
            )}
          </div>
          
          {/* Seletor de Paciente para Profissionais */}
          {profile?.tipo === 'profissional' && patients.length > 0 && (
            <div className="mr-4">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="text-sm border rounded-md px-3 py-1 bg-background"
              >
                <option value="">Selecione um paciente</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === '7d' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === '30d' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              30 dias
            </button>
            <button
              onClick={() => setPeriod('90d')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === '90d' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              90 dias
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Humor Médio</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{stats.avgMood}/10</p>
                    {getTrendIcon(stats.moodTrend)}
                  </div>
                  <p className={`text-xs ${getTrendColor(stats.moodTrend)}`}>
                    {stats.moodTrend > 0 ? '+' : ''}{stats.moodTrend} vs período anterior
                  </p>
                </div>
                <Heart className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Energia Média</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{stats.avgEnergy}/10</p>
                    {getTrendIcon(stats.energyTrend)}
                  </div>
                  <p className={`text-xs ${getTrendColor(stats.energyTrend)}`}>
                    {stats.energyTrend > 0 ? '+' : ''}{stats.energyTrend} vs período anterior
                  </p>
                </div>
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sono Médio</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{stats.avgSleep}h</p>
                    {getTrendIcon(stats.sleepTrend)}
                  </div>
                  <p className={`text-xs ${getTrendColor(stats.sleepTrend)}`}>
                    {stats.sleepTrend > 0 ? '+' : ''}{stats.sleepTrend}h vs período anterior
                  </p>
                </div>
                <Moon className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sequência</p>
                  <p className="text-2xl font-bold">{stats.streakDays}</p>
                  <p className="text-xs text-muted-foreground">
                    dias consecutivos
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {records.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
              <p className="text-muted-foreground">
                {profile?.tipo === 'paciente' 
                  ? 'Comece fazendo registros diários para ver suas estatísticas'
                  : profile?.tipo === 'profissional' && !selectedPatient
                  ? 'Selecione um paciente para ver as estatísticas'
                  : 'O paciente selecionado ainda não fez registros'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Gráfico de Linha - Tendências */}
            <Card>
              <CardHeader>
                <CardTitle>Tendências ao Longo do Tempo</CardTitle>
                <CardDescription>
                  Acompanhe a evolução do humor, energia e sono
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="humor" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Humor"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="energia" 
                        stroke="hsl(var(--health-warning))" 
                        strokeWidth={2}
                        name="Energia"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Barras - Sono */}
            <Card>
              <CardHeader>
                <CardTitle>Padrão de Sono</CardTitle>
                <CardDescription>
                  Visualize suas horas de sono ao longo do período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 12]} />
                      <Tooltip />
                      <Bar 
                        dataKey="sono" 
                        fill="hsl(var(--health-success))" 
                        name="Horas de Sono"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Resumo e Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Resumo do Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de registros:</span>
                    <span className="font-medium">{stats.totalRecords}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dias com registro:</span>
                    <span className="font-medium">
                      {chartData.filter(day => day.humor > 0).length} de {chartData.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sequência atual:</span>
                    <span className="font-medium">{stats.streakDays} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Média geral:</span>
                    <span className="font-medium">
                      H:{stats.avgMood} E:{stats.avgEnergy} S:{stats.avgSleep}h
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Insights e Recomendações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {(() => {
                    const lastRecord = records[records.length - 1];
                    const lastMood = lastRecord ? parseInt(lastRecord.humor) : 0;
                    
                    // Usar o último registro para o sono
                    const lastSleep = lastRecord?.sleep_hours || 0;
                    
                    return (
                      <>
                        {stats.avgMood < 5 && (
                          <div className="p-3 bg-health-warning/10 border border-health-warning/20 rounded-lg">
                            <p className="text-health-warning font-medium">⚠️ Humor abaixo da média</p>
                            <p className="text-muted-foreground">Considere buscar apoio profissional</p>
                          </div>
                        )}
                        
                        {lastSleep > 0 && lastSleep < 7 && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-blue-700 font-medium">💤 Sono insuficiente</p>
                            <p className="text-muted-foreground">Em seu último registro você dormiu apenas {lastSleep}h. Tente dormir pelo menos 7-8 horas</p>
                          </div>
                        )}
                        
                        {lastSleep >= 8 && (
                          <div className="p-3 bg-health-success/10 border border-health-success/20 rounded-lg">
                            <p className="text-health-success font-medium">😴 Ótimo descanso!</p>
                            <p className="text-muted-foreground">Em seu último registro você teve uma boa noite de sono com {lastSleep}h</p>
                          </div>
                        )}
                        
                        {stats.streakDays >= 7 && (
                          <div className="p-3 bg-health-success/10 border border-health-success/20 rounded-lg">
                            <p className="text-health-success font-medium">🎉 Ótima consistência!</p>
                            <p className="text-muted-foreground">Continue registrando diariamente</p>
                          </div>
                        )}
                        
                        {lastMood > stats.avgMood + 1 && (
                          <div className="p-3 bg-health-success/10 border border-health-success/20 rounded-lg">
                            <p className="text-health-success font-medium">📈 Humor em alta</p>
                            <p className="text-muted-foreground">Seu último humor ({lastMood}) está acima da sua média ({stats.avgMood})</p>
                          </div>
                        )}
                        
                        {lastMood < stats.avgMood - 1 && (
                          <div className="p-3 bg-health-warning/10 border border-health-warning/20 rounded-lg">
                            <p className="text-health-warning font-medium">📉 Humor em baixa</p>
                            <p className="text-muted-foreground">Seu último humor ({lastMood}) está abaixo da sua média ({stats.avgMood})</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Estatisticas;