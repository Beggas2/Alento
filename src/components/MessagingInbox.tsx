import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Download, 
  X,
  User,
  Stethoscope,
  Clock,
  MessageCircle,
  ArrowLeft,
  Plus,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

interface MessageThread {
  id: string;
  patient_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  patient_name?: string;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  has_attachment: boolean;
  created_at: string;
  author_name?: string;
  author_type?: 'patient' | 'professional';
  is_read?: boolean;
}

interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
}

interface Recipient {
  id: string;
  name: string;
  type: 'patient' | 'professional';
}

export const MessagingInbox: React.FC = () => {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
  }, [profile]);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);
    }
  }, [selectedThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('message_threads')
        .select(`
          *,
          messages(
            id,
            body,
            created_at,
            author_id
          )
        `)
        .order('updated_at', { ascending: false });

      const { data: threadsData, error } = await query;
      if (error) throw error;

      // Get patient names and unread counts
      const threadsWithDetails = await Promise.all(
        threadsData?.map(async (thread) => {
          // Get patient user_id
          const { data: patientData } = await supabase
            .from('patients')
            .select('id, user_id')
            .eq('id', thread.patient_id)
            .single();

          // Get patient profile name
          let patientName = 'Paciente';
          if (patientData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('nome')
              .eq('user_id', patientData.user_id)
              .single();
            
            if (profileData?.nome) {
              patientName = profileData.nome;
            }
          }

          // Get last message
          const lastMessage = thread.messages && thread.messages.length > 0
            ? thread.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('thread_id', thread.id)
            .neq('author_id', profile.user_id)
            .not('id', 'in', `(
              SELECT message_id FROM message_read_status 
              WHERE user_id = '${profile.user_id}'
            )`);

          return {
            ...thread,
            patient_name: patientName,
            last_message: lastMessage?.body ? (lastMessage.body.substring(0, 100) + (lastMessage.body.length > 100 ? '...' : '')) : '',
            unread_count: unreadCount || 0
          };
        }) || []
      );

      setThreads(threadsWithDetails);
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    if (!profile) return;

    try {
      setLoadingMessages(true);
      
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get author details and read status
      const messagesWithDetails = await Promise.all(
        messagesData?.map(async (message) => {
          // Get author profile
          const { data: authorData } = await supabase
            .from('profiles')
            .select('nome, tipo, user_id')
            .eq('user_id', message.author_id)
            .single();

          // Check if message is read
          const { data: readStatus } = await supabase
            .from('message_read_status')
            .select('id')
            .eq('message_id', message.id)
            .eq('user_id', profile.user_id)
            .single();

          return {
            ...message,
            author_name: authorData?.nome || 'Usuário',
            author_type: (authorData?.tipo === 'profissional' ? 'professional' : 'patient') as 'patient' | 'professional',
            is_read: !!readStatus
          };
        }) || []
      );

      setMessages(messagesWithDetails);

      // Mark unread messages as read
      const unreadMessages = messagesWithDetails.filter(m => !m.is_read && m.author_id !== profile.user_id);
      if (unreadMessages.length > 0) {
        await Promise.all(
          unreadMessages.map(message =>
            supabase
              .from('message_read_status')
              .insert({
                message_id: message.id,
                user_id: profile.user_id
              })
          )
        );
        // Refresh threads to update unread counts
        fetchThreads();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchAvailableRecipients = async () => {
    if (!profile) return;

    try {
      if (profile.tipo === 'paciente') {
        // Get patient's professionals
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (!patientData) return;

        const { data: professionalsData } = await supabase
          .from('patient_professionals')
          .select(`
            professional_id,
            profiles!inner(id, nome, user_id)
          `)
          .eq('patient_id', patientData.id)
          .eq('status', 'active');

        const recipients: Recipient[] = professionalsData?.map(p => ({
          id: p.profiles.id,
          name: p.profiles.nome,
          type: 'professional' as const
        })) || [];

        setAvailableRecipients(recipients);
      } else {
        // Get professional's patients
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_professionals')
          .select(`
            patient_id,
            patients!inner(
              id,
              user_id
            )
          `)
          .eq('professional_id', profile.id)
          .eq('status', 'active');

        if (patientsError) {
          console.error('Error fetching patients:', patientsError);
          return;
        }

        // Get profile names for each patient
        const recipients: Recipient[] = [];
        if (patientsData && patientsData.length > 0) {
          for (const p of patientsData) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, nome, user_id')
              .eq('user_id', p.patients.user_id)
              .single();

            if (profileData) {
              recipients.push({
                id: p.patients.id,
                name: profileData.nome,
                type: 'patient' as const
              });
            }
          }
        }

        console.log('Available recipients:', recipients);
        setAvailableRecipients(recipients);
      }
    } catch (error) {
      console.error('Error fetching recipients:', error);
    }
  };

  const openNewThreadDialog = async () => {
    await fetchAvailableRecipients();
    setShowNewThreadDialog(true);
  };

  const createNewThread = async () => {
    if (!profile || !selectedRecipient) return;

    try {
      let patientId: string;
      
      if (profile.tipo === 'paciente') {
        // Patient creating thread
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (!patientData) {
          toast.error('Erro: registro de paciente não encontrado');
          return;
        }
        patientId = patientData.id;
      } else {
        // Professional creating thread
        patientId = selectedRecipient.id;
      }

      // Check if thread already exists
      const { data: existingThread } = await supabase
        .from('message_threads')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (existingThread) {
        // Thread exists, just select it
        await fetchThreads();
        const thread = threads.find(t => t.id === existingThread.id);
        if (thread) {
          setSelectedThread(thread);
        }
        setShowNewThreadDialog(false);
        setSelectedRecipient(null);
        return;
      }

      // Create new thread
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          patient_id: patientId
        })
        .select()
        .single();

      if (threadError) throw threadError;

      // Add patient as participant
      const { data: patientUserData } = await supabase
        .from('patients')
        .select('profiles!inner(user_id)')
        .eq('id', patientId)
        .single();

      if (patientUserData) {
        await supabase
          .from('message_participants')
          .insert({
            thread_id: threadData.id,
            user_id: patientUserData.profiles.user_id,
            role: 'patient'
          });
      }

      // Add professionals as participants
      const { data: professionalData } = await supabase
        .from('patient_professionals')
        .select(`
          professional_id,
          profiles!inner(user_id)
        `)
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (professionalData && professionalData.length > 0) {
        await Promise.all(
          professionalData.map(prof =>
            supabase
              .from('message_participants')
              .insert({
                thread_id: threadData.id,
                user_id: prof.profiles.user_id,
                role: 'professional'
              })
          )
        );
      }

      // Refresh threads and select the new one
      await fetchThreads();
      setShowNewThreadDialog(false);
      setSelectedRecipient(null);
      
      toast.success('Conversa criada');
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Erro ao criar nova conversa');
    }
  };

  const deleteThread = async (threadId: string) => {
    if (!confirm('Tem certeza que deseja apagar esta conversa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // Delete thread (messages will be cascade deleted)
      const { error } = await supabase
        .from('message_threads')
        .delete()
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Conversa apagada');
      
      // Clear selected thread if it was deleted
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
        setMessages([]);
      }
      
      // Refresh threads list
      await fetchThreads();
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Erro ao apagar conversa');
    }
  };

  const sendMessage = async () => {
    if (!selectedThread || !newMessage.trim() || !profile) return;

    try {
      setSending(true);
      
      // Create message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          thread_id: selectedThread.id,
          author_id: profile.user_id,
          body: newMessage.trim(),
          has_attachment: attachments.length > 0
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Handle attachments
      if (attachments.length > 0) {
        await Promise.all(
          attachments.map(async (file, index) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedThread.id}/${messageData.id}-${index}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('message-attachments')
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            await supabase
              .from('message_attachments')
              .insert({
                message_id: messageData.id,
                file_name: file.name,
                file_path: fileName,
                mime_type: file.type,
                size_bytes: file.size
              });
          })
        );
      }

      // Clear form
      setNewMessage('');
      setAttachments([]);
      
      // Refresh messages and threads
      await fetchMessages(selectedThread.id);
      await fetchThreads();

      toast.success('Mensagem enviada');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type)) {
        toast.error(`Tipo de arquivo não suportado: ${file.name}`);
        return false;
      }
      
      if (file.size > maxSize) {
        toast.error(`Arquivo muito grande: ${file.name} (máx. 10MB)`);
        return false;
      }
      
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles].slice(0, 3)); // Max 3 files
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = async (attachment: MessageAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Erro ao baixar anexo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  // Mobile: show threads or messages view
  if (isMobile) {
    return (
      <div className="h-full">
        {!selectedThread ? (
          // Thread List (Mobile)
          <Card className="h-full flex flex-col border-0 shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Conversas
                </CardTitle>
                <Button 
                  onClick={openNewThreadDialog}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {threads.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground text-sm">
                      {profile?.tipo === 'paciente' 
                        ? 'Clique em "Nova" para começar'
                        : 'Nenhuma conversa encontrada'
                      }
                    </p>
                  </div>
                ) : (
                  threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="p-4 border-b last:border-b-0 hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer"
                          onClick={() => setSelectedThread(thread)}
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-semibold text-sm">{thread.patient_name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {thread.unread_count! > 0 && (
                            <Badge className="bg-primary text-primary-foreground">
                              {thread.unread_count}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteThread(thread.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div 
                        className="cursor-pointer"
                        onClick={() => setSelectedThread(thread)}
                      >
                        {thread.last_message && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2 ml-12">
                            {thread.last_message}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-12">
                          <Clock className="h-3 w-3" />
                          {thread.last_message_at 
                            ? format(new Date(thread.last_message_at), 'dd/MM HH:mm')
                            : format(new Date(thread.created_at), 'dd/MM HH:mm')
                          }
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          // Message View (Mobile)
          <Card className="h-full flex flex-col border-0 shadow-none">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-3 text-base">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedThread(null)}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="truncate font-semibold">{selectedThread.patient_name}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">Carregando mensagens...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground">Envie a primeira mensagem!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isOwnMessage = message.author_id === profile?.user_id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                            <div
                              className={`p-3 rounded-lg ${
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {message.author_type === 'professional' ? (
                                  <Stethoscope className="h-3 w-3" />
                                ) : (
                                  <User className="h-3 w-3" />
                                )}
                                <span className="text-xs font-medium">
                                  {message.author_name}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs opacity-70">
                                  {format(new Date(message.created_at), 'dd/MM HH:mm')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Separator />

              {/* Message Composer */}
              <div className="p-3 space-y-2">
                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-muted px-2 py-1 rounded text-xs"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="min-h-[60px] max-h-[120px] resize-none flex-1 rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={attachments.length >= 3}
                      className="h-10 w-10 rounded-xl"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      size="icon"
                      className="h-10 w-10 rounded-xl"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full max-h-full">{/* ... keep existing code */}
      {/* Thread List */}
      <Card className="lg:col-span-1 border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversas
            </CardTitle>
            <Button size="sm" onClick={openNewThreadDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100%-80px)]">
            {threads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm font-medium mb-1">
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.tipo === 'paciente' 
                    ? 'Clique em "Nova" para começar'
                    : 'Aguardando mensagens'
                  }
                </p>
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-4 border-b last:border-b-0 transition-all hover:bg-accent/50 ${
                    selectedThread?.id === thread.id ? 'bg-accent border-l-4 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div 
                      className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 cursor-pointer"
                      onClick={() => setSelectedThread(thread)}
                    >
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setSelectedThread(thread)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate">{thread.patient_name}</h3>
                        {thread.unread_count! > 0 && (
                          <Badge className="bg-primary text-primary-foreground ml-2">
                            {thread.unread_count}
                          </Badge>
                        )}
                      </div>
                      {thread.last_message && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {thread.last_message}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {thread.last_message_at 
                          ? format(new Date(thread.last_message_at), 'dd/MM HH:mm')
                          : format(new Date(thread.created_at), 'dd/MM HH:mm')
                        }
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message View */}
      <Card className="lg:col-span-2 border-border/50 shadow-sm">
        {selectedThread ? (
          <>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-base font-semibold">{selectedThread.patient_name}</div>
                  <div className="text-xs text-muted-foreground font-normal">Conversa segura</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[calc(100%-80px)]">
              {/* Messages */}
              <ScrollArea className="flex-1 p-6 bg-accent/20">
                {loadingMessages ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Carregando mensagens...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                    <p className="text-sm text-muted-foreground">Envie a primeira mensagem!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isOwnMessage = message.author_id === profile?.user_id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[75%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                            <div
                              className={`p-4 rounded-2xl shadow-sm ${
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-card'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {message.author_type === 'professional' ? (
                                  <Stethoscope className="h-4 w-4" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                                <span className="text-xs font-semibold">
                                  {message.author_name}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
                              <div className="flex items-center justify-end mt-2">
                                <span className="text-xs opacity-70">
                                  {format(new Date(message.created_at), 'dd/MM HH:mm')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Separator />

              {/* Message Composer */}
              <div className="p-4 space-y-3 bg-background">
                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-muted px-2 py-1 rounded text-xs"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="min-h-[80px] max-h-[160px] resize-none rounded-xl border-border/50 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={attachments.length >= 3}
                      className="h-12 w-12 rounded-xl"
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      size="icon"
                      className="h-12 w-12 rounded-xl shadow-md hover:shadow-lg transition-shadow"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full bg-accent/10">
            <div className="text-center px-4">
              <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-primary/50" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Selecione uma conversa</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Escolha uma conversa na lista ao lado para visualizar e enviar mensagens de forma segura e criptografada.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* New Thread Dialog */}
      <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {profile?.tipo === 'paciente' 
                ? 'Selecionar Profissional' 
                : 'Selecionar Paciente'
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {availableRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {profile?.tipo === 'paciente' 
                  ? 'Nenhum profissional vinculado' 
                  : 'Nenhum paciente vinculado'
                }
              </p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {availableRecipients.map((recipient) => (
                    <Button
                      key={recipient.id}
                      variant={selectedRecipient?.id === recipient.id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedRecipient(recipient)}
                    >
                      {recipient.type === 'professional' ? (
                        <Stethoscope className="h-4 w-4 mr-2" />
                      ) : (
                        <User className="h-4 w-4 mr-2" />
                      )}
                      {recipient.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewThreadDialog(false);
                  setSelectedRecipient(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={createNewThread}
                disabled={!selectedRecipient}
              >
                Iniciar Conversa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};