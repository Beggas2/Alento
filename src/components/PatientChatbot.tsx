import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Bot, User, AlertTriangle, Phone, Trash2, Mic } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { VoiceConsentModal } from './VoiceConsentModal';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  risk_score?: number;
  timestamp: Date;
}

export function PatientChatbot() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: patient } = useQuery({
    queryKey: ['current-patient'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: crisisResources = [] } = useQuery({
    queryKey: ['crisis-resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crisis_resources')
        .select('*')
        .eq('country_code', 'BR')
        .eq('is_active', true)
        .order('hotline_name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['bot-interactions', patient?.id],
    queryFn: async () => {
      if (!patient?.id) return [];
      
      const { data, error } = await supabase
        .from('bot_interaction')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!patient?.id,
  });

  useEffect(() => {
    if (interactions.length > 0) {
      const loadedMessages: Message[] = [];
      interactions.forEach((interaction) => {
        loadedMessages.push({
          id: `${interaction.id}-user`,
          role: 'user',
          content: interaction.message,
          timestamp: new Date(interaction.created_at),
        });
        loadedMessages.push({
          id: interaction.id,
          role: 'bot',
          content: interaction.reply,
          risk_score: interaction.risk_score,
          timestamp: new Date(interaction.created_at),
        });
      });
      setMessages(loadedMessages);
    }
  }, [interactions]);

  const saveInteractionMutation = useMutation({
    mutationFn: async ({ message, reply, risk_score, matched_content_id }: any) => {
      const { error } = await supabase
        .from('bot_interaction')
        .insert({
          patient_id: patient?.id,
          message,
          reply,
          risk_score,
          matched_content_id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-interactions'] });
    },
  });

  const deleteAllInteractionsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('bot_interaction')
        .delete()
        .eq('patient_id', patient?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-interactions'] });
      setMessages([]);
      toast.success('Histórico de conversas deletado');
    },
    onError: (error) => {
      toast.error('Erro ao deletar histórico: ' + error.message);
    },
  });

  const processMessage = async (userMessage: string) => {
    if (!patient?.id) {
      toast.error('Paciente não encontrado');
      return;
    }

    setIsProcessing(true);

    // Add user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Call AI-powered chatbot endpoint
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chatbot-ai', {
        body: {
          message: userMessage,
          patientId: patient.id,
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        }
      });

      if (aiError) {
        console.error('AI chatbot error:', aiError);
        throw new Error(aiError.message || 'Erro ao processar mensagem');
      }

      const { reply, riskScore, needsCrisisAlert } = aiResponse;

      // Show crisis alert banner if needed
      if (needsCrisisAlert) {
        setShowCrisisAlert(true);
      }

      // Add bot response
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: reply,
        risk_score: riskScore,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);

      // Save interaction
      await saveInteractionMutation.mutateAsync({
        message: userMessage,
        reply: reply,
        risk_score: riskScore,
        matched_content_id: null,
      });

    } catch (error: any) {
      console.error('Error processing message:', error);
      toast.error('Erro ao processar mensagem. Por favor, tente novamente.');
      
      // Remove the user message on error
      setMessages((prev) => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    processMessage(input.trim());
    setInput('');
  };

  const handleVoiceClick = () => {
    const hasConsent = localStorage.getItem('voice_consent_given');
    if (hasConsent) {
      setShowVoiceRecorder(true);
    } else {
      setShowConsentModal(true);
    }
  };

  const handleConsentGiven = () => {
    setShowConsentModal(false);
    setShowVoiceRecorder(true);
  };

  const handleTranscriptionComplete = async (text: string) => {
    setShowVoiceRecorder(false);
    await processMessage(text);
  };

  const handleDeleteHistory = () => {
    if (confirm('Tem certeza que deseja deletar todo o histórico de conversas? Esta ação não pode ser desfeita.')) {
      deleteAllInteractionsMutation.mutate();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-4">
      <Alert variant="default" className="bg-primary/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Aviso Importante:</strong> Este chatbot não substitui atendimento médico de emergência. 
          Em caso de crise, entre em contato com os serviços de emergência ou com seus profissionais de saúde.
        </AlertDescription>
      </Alert>

      {showCrisisAlert && (
        <Alert variant="destructive">
          <Phone className="h-4 w-4" />
          <AlertDescription>
            <strong>RECURSOS DE CRISE DISPONÍVEIS 24/7:</strong>
            <div className="mt-2 space-y-1">
              {crisisResources.map((resource) => (
                <div key={resource.id}>
                  <strong>{resource.hotline_name}:</strong> {resource.phone_number}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Nala
            </CardTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteHistory}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Histórico
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Oi, eu sou a Nala 🌿</p>
                  <p className="text-sm mt-2">Estou aqui pra te ouvir e ajudar a entender como você tem se sentido.</p>
                  <p className="text-sm mt-1">Cada registro que você faz é um passo pra cuidar de você com mais clareza e leveza.</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  
                  <div
                    className={`rounded-lg p-4 max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.risk_score !== undefined && message.risk_score > 0 && (
                      <Badge
                        variant={message.risk_score > 70 ? 'destructive' : 'secondary'}
                        className="mt-2"
                      >
                        Risco: {message.risk_score}
                      </Badge>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {showVoiceRecorder ? (
            <div className="mt-4">
              <VoiceRecorder
                patientId={patient?.id || ''}
                onTranscriptionComplete={handleTranscriptionComplete}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleVoiceClick}
                  disabled={isProcessing}
                  title="Enviar mensagem de voz"
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite ou grave uma mensagem..."
                  disabled={isProcessing}
                />
                <Button type="submit" disabled={isProcessing || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>

              <p className="text-xs text-muted-foreground mt-2">
                Suas conversas são privadas e você pode deletá-las a qualquer momento.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <VoiceConsentModal
        open={showConsentModal}
        onConsent={handleConsentGiven}
        onDecline={() => setShowConsentModal(false)}
      />
    </div>
  );
}