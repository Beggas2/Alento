import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Heart, Zap, Moon, AlertTriangle, User, ChevronLeft, ChevronRight } from 'lucide-react';
import MoodEditor from '@/components/MoodEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentManager } from '@/components/AppointmentManager';
interface DailyRecord {
  id: string;
  patient_id: string;
  como_se_sentiu: string | null;
  data: string;
  gatilhos: string | null;
  humor: string;
  observacoes_profissional: string | null;
  sinal_alerta: boolean | null;
  sleep_hours: number | null;
  energia: number | null;
  created_at: string;
  updated_at: string;
}

interface Patient {
  id: string;
  nome: string;
}

interface MedicationIntake {
  id: string;
  medication_id: string;
  data_horario: string;
  tomado: boolean;
  medication: {
    nome_medicamento: string;
    dosagem: string;
    horarios: string[];
  };
}

const Calendario = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [editingMood, setEditingMood] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [medicationIntakes, setMedicationIntakes] = useState<MedicationIntake[]>([]);

  useEffect(() => {
    if (profile?.tipo === 'profissional') {
      fetchPatients();
    } else if (profile) {
      fetchRecords();
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.tipo === 'paciente' || (profile?.tipo === 'profissional' && selectedPatient)) {
      fetchRecords();
    }
  }, [currentMonth, selectedPatient]);

  useEffect(() => {
    fetchMedicationIntakes();
  }, [selectedDate, selectedPatient, profile]);

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
          
          // Selecionar primeiro paciente automaticamente
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
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('daily_records')
        .select('*')
        .gte('data', start)
        .lte('data', end)
        .order('data', { ascending: false });

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
          setLoading(false);
          return;
        }
      } else if (profile?.tipo === 'profissional' && selectedPatient) {
        // Se for profissional, buscar registros apenas do paciente selecionado
        query = query.eq('patient_id', selectedPatient);
      } else {
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      setRecords(data || []);
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

  const fetchMedicationIntakes = async () => {
    try {
      let patientIdToFetch = '';

      if (profile?.tipo === 'paciente') {
        // Buscar ID do próprio paciente
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();
        
        if (patient) {
          patientIdToFetch = patient.id;
        }
      } else if (profile?.tipo === 'profissional' && selectedPatient) {
        patientIdToFetch = selectedPatient;
      }

      if (!patientIdToFetch) {
        setMedicationIntakes([]);
        return;
      }

      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

      // Buscar as tomadas do dia selecionado
      const { data: intakes, error: intakeError } = await supabase
        .from('medication_intakes')
        .select('*')
        .eq('patient_id', patientIdToFetch)
        .gte('data_horario', `${selectedDateStr}T00:00:00`)
        .lte('data_horario', `${selectedDateStr}T23:59:59`);

      if (intakeError) throw intakeError;

      if (!intakes || intakes.length === 0) {
        setMedicationIntakes([]);
        return;
      }

      // Buscar informações dos medicamentos para cada tomada
      const medicationIds = [...new Set(intakes.map(intake => intake.medication_id))];
      
      const { data: medications, error: medError } = await supabase
        .from('medications')
        .select('id, nome_medicamento, dosagem, horarios')
        .in('id', medicationIds);

      if (medError) throw medError;

      // Combinar tomadas com informações dos medicamentos
      const formattedIntakes = intakes.map(intake => {
        const medication = medications?.find(med => med.id === intake.medication_id);
        return {
          id: intake.id,
          medication_id: intake.medication_id,
          data_horario: intake.data_horario,
          tomado: intake.tomado,
          medication: {
            nome_medicamento: medication?.nome_medicamento || 'Medicamento não encontrado',
            dosagem: medication?.dosagem || '',
            horarios: medication?.horarios || []
          }
        };
      });

      setMedicationIntakes(formattedIntakes);
    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
    }
  };

  const getRecordForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return records.find(record => record.data === dateStr);
  };

  const getMoodColor = (humorStr: string) => {
    const level = parseInt(humorStr);
    if (level <= 3) return 'bg-health-danger';
    if (level <= 6) return 'bg-health-warning';
    return 'bg-health-success';
  };

  const getMoodColorText = (humorStr: string) => {
    const level = parseInt(humorStr);
    if (level <= 3) return 'text-health-danger';
    if (level <= 6) return 'text-health-warning';
    return 'text-health-success';
  };

  const getMoodLabel = (humorStr: string) => {
    const level = parseInt(humorStr);
    if (level <= 2) return 'Muito baixo';
    if (level <= 4) return 'Baixo';
    if (level <= 6) return 'Neutro';
    if (level <= 8) return 'Bom';
    return 'Excelente';
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const record = getRecordForDate(date);
    setSelectedRecord(record || null);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const daysOfMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  // Adicionar dias do mês anterior para completar a primeira semana
  const firstDayOfMonth = startOfMonth(currentMonth);
  const startDay = firstDayOfMonth.getDay(); // 0 = domingo
  const daysFromPrevMonth = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(firstDayOfMonth);
    date.setDate(date.getDate() - (i + 1));
    daysFromPrevMonth.push(date);
  }

  // Adicionar dias do próximo mês para completar a última semana
  const lastDayOfMonth = endOfMonth(currentMonth);
  const endDay = lastDayOfMonth.getDay(); // 0 = domingo
  const daysFromNextMonth = [];
  for (let i = 1; i <= (6 - endDay); i++) {
    const date = new Date(lastDayOfMonth);
    date.setDate(date.getDate() + i);
    daysFromNextMonth.push(date);
  }

  const allDays = [...daysFromPrevMonth, ...daysOfMonth, ...daysFromNextMonth];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur">
          <div className="flex h-14 items-center px-6">
            <SidebarTrigger />
            <div className="ml-4">
              <h2 className="font-semibold text-foreground">Calendário</h2>
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
        <div className="flex h-14 items-center px-4 md:px-6 justify-between gap-2">
          <div className="flex items-center min-w-0">
            <SidebarTrigger />
            <div className="ml-2 md:ml-4 min-w-0 flex-1">
              <h2 className="font-semibold text-foreground truncate">Calendário</h2>
              {profile?.tipo === 'profissional' && selectedPatient && !isMobile && (
                <p className="text-xs text-muted-foreground truncate">
                  Paciente: {patients.find(p => p.id === selectedPatient)?.nome}
                </p>
              )}
            </div>
          </div>
          
          {/* Seletor de Paciente para Profissionais */}
          {profile?.tipo === 'profissional' && patients.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isMobile && <User className="h-4 w-4 text-muted-foreground" />}
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger className={isMobile ? "w-[140px]" : "w-[200px]"}>
                  <SelectValue placeholder="Paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      <div className="p-4 md:p-6">
        {isMobile ? (
          // Layout Mobile com Tabs
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="calendar">Calendário</TabsTrigger>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
            
            <TabsContent value="calendar" className="mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(currentMonth, "MMM 'de' yyyy", { locale: ptBR })}
                    </CardTitle>
                    <div className="flex gap-1">
                      <button
                        onClick={handlePreviousMonth}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-xs font-medium text-muted-foreground p-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {allDays.map((date, index) => {
                      const record = getRecordForDate(date);
                      const isCurrentMonth = isSameMonth(date, currentMonth);
                      const isSelected = isSameDay(date, selectedDate);
                      const isToday = isSameDay(date, new Date());
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateClick(date)}
                          className={`
                            relative p-1 h-10 w-full text-xs rounded-md transition-colors
                            ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                            ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}
                            ${isToday && !isSelected ? 'bg-primary/10 text-primary font-medium' : ''}
                            ${!isSelected && !isToday ? 'hover:bg-muted/50' : ''}
                          `}
                        >
                          <span className="relative z-10">{date.getDate()}</span>
                          {record && isCurrentMonth && (
                            <div 
                              className={`
                                absolute bottom-0.5 left-1/2 transform -translate-x-1/2 
                                w-1.5 h-1.5 rounded-full ${getMoodColor(record.humor)}
                              `}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Legenda Mobile */}
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Legenda</p>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-health-success"></div>
                        <span className="text-muted-foreground">Alto (7-10)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-health-warning"></div>
                        <span className="text-muted-foreground">Neutro (4-6)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-health-danger"></div>
                        <span className="text-muted-foreground">Baixo (1-3)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="details" className="mt-0">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedRecord ? 'Registro encontrado' : 'Nenhum registro'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {selectedRecord ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {profile?.tipo === 'paciente' ? (
                            <MoodEditor
                              recordId={selectedRecord.id}
                              currentMood={parseInt(selectedRecord.humor)}
                              onUpdate={fetchRecords}
                              isEditing={editingMood}
                              onToggleEdit={() => setEditingMood(!editingMood)}
                            />
                          ) : (
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Heart className={`h-4 w-4 ${getMoodColorText(selectedRecord.humor)}`} />
                                <span className="text-sm font-medium">Humor</span>
                              </div>
                              <div className="text-right">
                                <div className={`text-lg font-bold ${getMoodColorText(selectedRecord.humor)}`}>
                                  {selectedRecord.humor}/10
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {getMoodLabel(selectedRecord.humor)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Sono e Energia */}
                          <div className="grid grid-cols-2 gap-2">
                            {selectedRecord.sleep_hours && (
                              <div className="flex flex-col p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Moon className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-medium">Sono</span>
                                </div>
                                <div className="text-lg font-bold text-primary">
                                  {selectedRecord.sleep_hours}h
                                </div>
                              </div>
                            )}
                            
                            {selectedRecord.energia && (
                              <div className="flex flex-col p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Zap className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-medium">Energia</span>
                                </div>
                                <div className="text-lg font-bold text-primary">
                                  {selectedRecord.energia}/10
                                </div>
                              </div>
                            )}
                          </div>

                          {selectedRecord.sinal_alerta && (
                            <div className="flex items-center justify-between p-3 bg-health-danger/10 border border-health-danger/20 rounded-lg">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-health-danger" />
                                <span className="text-sm font-medium text-health-danger">Sinal de Alerta</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedRecord.como_se_sentiu && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-muted-foreground">Como se sentiu</h4>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                              {selectedRecord.como_se_sentiu}
                            </div>
                          </div>
                        )}

                        {selectedRecord.gatilhos && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-muted-foreground">Gatilhos</h4>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                              {selectedRecord.gatilhos}
                            </div>
                          </div>
                        )}

                        {selectedRecord.observacoes_profissional && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-muted-foreground">Observações do Profissional</h4>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                              {selectedRecord.observacoes_profissional}
                            </div>
                          </div>
                        )}

                        {/* Medicamentos */}
                        {medicationIntakes.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-muted-foreground">Medicamentos</h4>
                            <div className="space-y-2">
                              {medicationIntakes.map((intake) => (
                                <div key={intake.id} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{intake.medication.nome_medicamento}</p>
                                      <p className="text-xs text-muted-foreground">{intake.medication.dosagem}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <div className="text-xs font-mono mb-1">
                                        {format(new Date(intake.data_horario), 'HH:mm')}
                                      </div>
                                      <Badge 
                                        variant={intake.tomado ? "default" : "outline"} 
                                        className={`text-xs ${intake.tomado ? "bg-health-success text-white" : "text-health-danger border-health-danger"}`}
                                      >
                                        {intake.tomado ? 'Tomado' : 'Não tomado'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Registrado em: {format(new Date(selectedRecord.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {medicationIntakes.length > 0 ? (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-medium text-muted-foreground">Medicamentos</h4>
                            <div className="space-y-2">
                              {medicationIntakes.map((intake) => (
                                <div key={intake.id} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{intake.medication.nome_medicamento}</p>
                                      <p className="text-xs text-muted-foreground">{intake.medication.dosagem}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <div className="text-xs font-mono mb-1">
                                        {format(new Date(intake.data_horario), 'HH:mm')}
                                      </div>
                                      <Badge 
                                        variant={intake.tomado ? "default" : "outline"} 
                                        className={`text-xs ${intake.tomado ? "bg-health-success text-white" : "text-health-danger border-health-danger"}`}
                                      >
                                        {intake.tomado ? 'Tomado' : 'Não tomado'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">
                              Nenhum registro para este dia
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>

            {/* Aba Agenda Mobile */}
            <TabsContent value="agenda" className="mt-0">
              <AppointmentManager 
                selectedDate={selectedDate} 
                onDateChange={setSelectedDate} 
              />
            </TabsContent>
          </Tabs>
        ) : (
          // Layout Desktop
          <div className="flex gap-6">
            {/* Calendário */}
            <div className="flex-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                    </CardTitle>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePreviousMonth}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-muted rounded-md transition-colors"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <CardDescription>
                    {profile?.tipo === 'paciente' 
                      ? 'Visualize seu histórico de registros de humor'
                      : selectedPatient 
                        ? `Registros de ${patients.find(p => p.id === selectedPatient)?.nome}`
                        : 'Selecione um paciente para visualizar os registros'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {allDays.map((date, index) => {
                      const record = getRecordForDate(date);
                      const isCurrentMonth = isSameMonth(date, currentMonth);
                      const isSelected = isSameDay(date, selectedDate);
                      const isToday = isSameDay(date, new Date());
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateClick(date)}
                          className={`
                            relative p-2 h-12 w-full text-sm rounded-md transition-colors
                            ${!isCurrentMonth ? 'text-muted-foreground/50' : ''}
                            ${isSelected ? 'ring-2 ring-primary' : ''}
                            ${isToday ? 'bg-primary/10 text-primary font-medium' : ''}
                            ${!isSelected && !isToday ? 'hover:bg-muted/50' : ''}
                          `}
                        >
                          <span className="relative z-10">{date.getDate()}</span>
                          {record && isCurrentMonth && (
                            <div 
                              className={`
                                absolute bottom-1 left-1/2 transform -translate-x-1/2 
                                w-2 h-2 rounded-full ${getMoodColor(record.humor)}
                              `}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detalhes do dia selecionado */}
            <div className="w-80">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <CardDescription>
                    {selectedRecord ? 'Registro encontrado' : 'Nenhum registro'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                {selectedRecord ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {profile?.tipo === 'paciente' ? (
                        <MoodEditor
                          recordId={selectedRecord.id}
                          currentMood={parseInt(selectedRecord.humor)}
                          onUpdate={fetchRecords}
                          isEditing={editingMood}
                          onToggleEdit={() => setEditingMood(!editingMood)}
                        />
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Heart className={`h-4 w-4 ${getMoodColorText(selectedRecord.humor)}`} />
                            <span className="text-sm font-medium">Humor</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getMoodColorText(selectedRecord.humor)}`}>
                              {selectedRecord.humor}/10
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getMoodLabel(selectedRecord.humor)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sono e Energia */}
                      <div className="grid grid-cols-2 gap-2">
                        {selectedRecord.sleep_hours && (
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Moon className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Sono</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                {selectedRecord.sleep_hours}h
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {selectedRecord.energia && (
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Energia</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                {selectedRecord.energia}/10
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedRecord.sinal_alerta && (
                        <div className="flex items-center justify-between p-3 bg-health-danger/10 border border-health-danger/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-health-danger" />
                            <span className="text-sm font-medium text-health-danger">Sinal de Alerta</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedRecord.como_se_sentiu && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Como se sentiu</h4>
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                          {selectedRecord.como_se_sentiu}
                        </div>
                      </div>
                    )}

                    {selectedRecord.gatilhos && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Gatilhos</h4>
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                          {selectedRecord.gatilhos}
                        </div>
                      </div>
                    )}

                    {selectedRecord.observacoes_profissional && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Observações do Profissional</h4>
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                          {selectedRecord.observacoes_profissional}
                        </div>
                      </div>
                    )}

                    {/* Medicamentos */}
                    {medicationIntakes.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Medicamentos</h4>
                        <div className="space-y-2">
                          {medicationIntakes.map((intake) => (
                            <div key={intake.id} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{intake.medication.nome_medicamento}</p>
                                  <p className="text-xs text-muted-foreground">{intake.medication.dosagem}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-mono">
                                    {format(new Date(intake.data_horario), 'HH:mm')}
                                  </div>
                                  <Badge 
                                    variant={intake.tomado ? "default" : "outline"} 
                                    className={intake.tomado ? "bg-health-success text-white" : "text-health-danger border-health-danger"}
                                  >
                                    {intake.tomado ? 'Tomado' : 'Não tomado'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Registrado em: {format(new Date(selectedRecord.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {medicationIntakes.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Medicamentos</h4>
                        <div className="space-y-2">
                          {medicationIntakes.map((intake) => (
                            <div key={intake.id} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{intake.medication.nome_medicamento}</p>
                                  <p className="text-xs text-muted-foreground">{intake.medication.dosagem}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-mono">
                                    {format(new Date(intake.data_horario), 'HH:mm')}
                                  </div>
                                  <Badge 
                                    variant={intake.tomado ? "default" : "outline"} 
                                    className={intake.tomado ? "bg-health-success text-white" : "text-health-danger border-health-danger"}
                                  >
                                    {intake.tomado ? 'Tomado' : 'Não tomado'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum registro para este dia
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legenda */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Legenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-health-success"></div>
                  <span>Humor bom (7-10)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-health-warning"></div>
                  <span>Humor neutro (4-6)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-health-danger"></div>
                  <span>Humor baixo (1-3)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Seção de Agenda de Compromissos */}
        <div className="mt-6">
          <AppointmentManager 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate} 
          />
        </div>
      </div>
    </div>
  );
};

export default Calendario;