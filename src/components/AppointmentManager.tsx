import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay, isToday, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Plus, Edit, Trash2, User, Video, MapPin, Bell, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { GoogleCalendarConnect } from './GoogleCalendarConnect';

interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  location: string | null;
  telemedicine_link: string | null;
  sync_to_calendar: boolean;
  patient_name?: string;
}

interface Patient {
  id: string;
  nome: string;
}

interface AppointmentManagerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const AppointmentManager: React.FC<AppointmentManagerProps> = ({ selectedDate, onDateChange }) => {
  const { profile, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    patient_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    location: '',
    telemedicine_link: '',
    sync_to_calendar: false
  });

  const isProfessional = profile?.tipo === 'profissional';

  useEffect(() => {
    if (profile) {
      fetchAppointments();
      if (isProfessional) {
        fetchPatients();
      }
    }
  }, [profile, selectedDate, viewMode]);

  const getDateRange = useCallback(() => {
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case 'week':
        return { start: startOfWeek(selectedDate, { locale: ptBR }), end: endOfWeek(selectedDate, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
  }, [selectedDate, viewMode]);

  const fetchPatients = async () => {
    try {
      const { data: linkedPatients, error } = await supabase
        .from('patient_professionals')
        .select(`
          patient_id,
          patients(id, user_id)
        `)
        .eq('professional_id', profile?.id)
        .eq('status', 'active');

      if (error) throw error;

      if (linkedPatients && linkedPatients.length > 0) {
        const userIds = linkedPatients
          .map(link => link.patients?.user_id)
          .filter(Boolean);

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, nome')
            .in('user_id', userIds);

          const formattedPatients = linkedPatients.map(link => {
            if (!link.patients) return null;
            const patientProfile = profilesData?.find(p => p.user_id === link.patients?.user_id);
            return patientProfile ? { id: link.patients.id, nome: patientProfile.nome } : null;
          }).filter(Boolean) as Patient[];

          setPatients(formattedPatients);
        }
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });

      if (isProfessional) {
        query = query.eq('professional_id', profile?.id);
      } else {
        // Patient view - get their patient id first
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (patient) {
          query = query.eq('patient_id', patient.id);
        } else {
          setAppointments([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get patient names for professional view
      if (isProfessional && data && data.length > 0) {
        const patientIds = [...new Set(data.map(a => a.patient_id))];
        
        const { data: patientsData } = await supabase
          .from('patients')
          .select('id, user_id')
          .in('id', patientIds);

        if (patientsData) {
          const userIds = patientsData.map(p => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, nome')
            .in('user_id', userIds);

          const appointmentsWithNames = data.map(apt => {
            const patient = patientsData.find(p => p.id === apt.patient_id);
            const patientProfile = profiles?.find(pr => pr.user_id === patient?.user_id);
            return { ...apt, patient_name: patientProfile?.nome || 'Paciente' };
          });

          setAppointments(appointmentsWithNames);
        } else {
          setAppointments(data);
        }
      } else {
        setAppointments(data || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Erro ao carregar compromissos');
    } finally {
      setLoading(false);
    }
  };

  const syncToGoogleCalendar = async (action: 'create' | 'update' | 'delete', appointment?: AppointmentData, appointmentId?: string) => {
    try {
      const patientName = appointment?.patient_id 
        ? patients.find(p => p.id === appointment.patient_id)?.nome 
        : undefined;

      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action,
          userId: user?.id,
          appointment: appointment ? {
            id: appointment.id,
            title: appointment.title,
            description: appointment.description,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            location: appointment.location,
            telemedicine_link: appointment.telemedicine_link,
            patient_name: patientName
          } : undefined,
          appointmentId
        }
      });

      if (error) {
        console.error('Google Calendar sync error:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      return false;
    }
  };

  interface AppointmentData {
    id: string;
    title: string;
    description?: string | null;
    patient_id: string;
    start_time: string;
    end_time: string;
    location?: string | null;
    telemedicine_link?: string | null;
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.patient_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const startDateTime = new Date(`${formData.start_date}T${formData.start_time}:00`);
      const endDateTime = new Date(`${formData.start_date}T${formData.end_time}:00`);

      const appointmentData = {
        title: formData.title,
        description: formData.description || null,
        patient_id: formData.patient_id,
        professional_id: profile?.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location: formData.location || null,
        telemedicine_link: formData.telemedicine_link || null,
        sync_to_calendar: formData.sync_to_calendar,
        status: 'scheduled'
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointment.id);

        if (error) throw error;
        
        // Sync to Google Calendar if enabled
        if (formData.sync_to_calendar) {
          const synced = await syncToGoogleCalendar('update', { 
            id: editingAppointment.id, 
            ...appointmentData 
          });
          if (synced) {
            toast.success('Compromisso atualizado e sincronizado!');
          } else {
            toast.success('Compromisso atualizado! (Sincronização não disponível)');
          }
        } else {
          toast.success('Compromisso atualizado!');
        }
      } else {
        const { data: newAppointment, error } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();

        if (error) throw error;
        
        // Sync to Google Calendar if enabled
        if (formData.sync_to_calendar && newAppointment) {
          const synced = await syncToGoogleCalendar('create', { 
            id: newAppointment.id, 
            ...appointmentData 
          });
          if (synced) {
            toast.success('Compromisso criado e sincronizado com Google Calendar!');
          } else {
            toast.success('Compromisso criado! (Conecte sua conta Google para sincronizar)');
          }
        } else {
          toast.success('Compromisso criado!');
        }
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Erro ao salvar compromisso');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este compromisso?')) return;

    try {
      // First sync delete to Google Calendar
      const appointment = appointments.find(a => a.id === id);
      if (appointment?.sync_to_calendar) {
        await syncToGoogleCalendar('delete', undefined, id);
      }

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Compromisso excluído');
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Erro ao excluir compromisso');
    }
  };

  const handleEdit = (appointment: Appointment) => {
    const startDate = parseISO(appointment.start_time);
    const endDate = parseISO(appointment.end_time);
    
    setEditingAppointment(appointment);
    setFormData({
      title: appointment.title,
      description: appointment.description || '',
      patient_id: appointment.patient_id,
      start_date: format(startDate, 'yyyy-MM-dd'),
      start_time: format(startDate, 'HH:mm'),
      end_time: format(endDate, 'HH:mm'),
      location: appointment.location || '',
      telemedicine_link: appointment.telemedicine_link || '',
      sync_to_calendar: appointment.sync_to_calendar
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAppointment(null);
    setFormData({
      title: '',
      description: '',
      patient_id: '',
      start_date: format(selectedDate, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
      location: '',
      telemedicine_link: '',
      sync_to_calendar: false
    });
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary/10 text-primary border-primary/20';
      case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const days = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
    const newDate = addDays(selectedDate, direction === 'prev' ? -days : days);
    onDateChange(newDate);
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const startTime = parseISO(appointment.start_time);
    const isPast = isBefore(startTime, new Date()) && !isToday(startTime);

    return (
      <div
        key={appointment.id}
        className={`p-4 rounded-xl border transition-all hover:shadow-md ${isPast ? 'opacity-60' : ''} bg-card`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">{appointment.title}</h4>
              <Badge variant="outline" className={`text-xs ${getStatusColor(appointment.status)}`}>
                {getStatusLabel(appointment.status)}
              </Badge>
            </div>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>
                  {format(startTime, 'HH:mm')} - {format(parseISO(appointment.end_time), 'HH:mm')}
                </span>
                {viewMode !== 'day' && (
                  <span className="ml-1">
                    ({format(startTime, 'dd/MM', { locale: ptBR })})
                  </span>
                )}
              </div>
              
              {isProfessional && appointment.patient_name && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  <span>{appointment.patient_name}</span>
                </div>
              )}
              
              {appointment.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{appointment.location}</span>
                </div>
              )}
              
              {appointment.telemedicine_link && (
                <div className="flex items-center gap-1.5">
                  <Video className="h-3 w-3 text-primary" />
                  <a 
                    href={appointment.telemedicine_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    Link da videochamada
                  </a>
                </div>
              )}

              {appointment.sync_to_calendar && (
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-600">Sincronizado com Google</span>
                </div>
              )}
            </div>
          </div>

          {isProfessional && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(appointment)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(appointment.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Google Calendar Integration - Only for professionals */}
      {isProfessional && (
        <GoogleCalendarConnect />
      )}

      {/* Main Agenda Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agenda de Compromissos
              </CardTitle>
              <CardDescription>
                {viewMode === 'day' && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {viewMode === 'week' && `Semana de ${format(startOfWeek(selectedDate, { locale: ptBR }), "dd/MM")} a ${format(endOfWeek(selectedDate, { locale: ptBR }), "dd/MM")}`}
                {viewMode === 'month' && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Tabs */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week' | 'month')}>
                <TabsList className="h-9">
                  <TabsTrigger value="day" className="text-xs px-3">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs px-3">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs px-3">Mês</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Navigation */}
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigatePeriod('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Add Button - Only for professionals */}
              {isProfessional && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={handleOpenDialog}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingAppointment ? 'Editar Compromisso' : 'Novo Compromisso'}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os detalhes do agendamento
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Título *</Label>
                        <Input
                          id="title"
                          placeholder="Ex: Consulta de rotina"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="patient">Paciente *</Label>
                        <Select
                          value={formData.patient_id}
                          onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o paciente" />
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

                      <div className="grid grid-cols-3 gap-2">
                        <div className="grid gap-2">
                          <Label htmlFor="date">Data</Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="start">Início</Label>
                          <Input
                            id="start"
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="end">Fim</Label>
                          <Input
                            id="end"
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="location">Local</Label>
                        <Input
                          id="location"
                          placeholder="Ex: Consultório 201"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="telemedicine">Link Telemedicina</Label>
                        <Input
                          id="telemedicine"
                          placeholder="https://meet.google.com/..."
                          value={formData.telemedicine_link}
                          onChange={(e) => setFormData({ ...formData, telemedicine_link: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          placeholder="Observações adicionais..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sync">Sincronizar com Google Calendar</Label>
                          <p className="text-xs text-muted-foreground">
                            Adiciona automaticamente ao seu calendário
                          </p>
                        </div>
                        <Switch
                          id="sync"
                          checked={formData.sync_to_calendar}
                          onCheckedChange={(checked) => setFormData({ ...formData, sync_to_calendar: checked })}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSubmit}>
                        {editingAppointment ? 'Salvar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Nenhum compromisso {viewMode === 'day' ? 'para este dia' : viewMode === 'week' ? 'nesta semana' : 'neste mês'}
              </p>
              {isProfessional && (
                <Button variant="outline" className="mt-4" onClick={handleOpenDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar compromisso
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {appointments.map(renderAppointmentCard)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
