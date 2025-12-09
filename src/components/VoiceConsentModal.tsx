import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceConsentModalProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export function VoiceConsentModal({ open, onConsent, onDecline }: VoiceConsentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConsent = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Save consent
      const { error } = await supabase
        .from('voice_consent')
        .insert({
          user_id: user.id,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        });

      if (error) throw error;

      // Store consent in localStorage to avoid asking again
      localStorage.setItem('voice_consent_given', 'true');
      
      onConsent();
      
      toast({
        title: 'Consentimento registrado',
        description: 'Você pode agora usar mensagens de voz.',
      });
    } catch (error) {
      console.error('Error saving consent:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar o consentimento.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mic className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Mensagens de Voz</DialogTitle>
          </div>
          <DialogDescription className="text-base space-y-3 pt-2">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p>
                Ao gravar mensagens de voz, você concorda com o processamento do seu áudio 
                para gerar texto e registrar sua mensagem no chat.
              </p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              <strong>Privacidade:</strong> Não compartilhamos seu áudio com terceiros fora 
              dos provedores de transcrição contratados (OpenAI Whisper). O áudio não é 
              armazenado permanentemente - apenas a transcrição em texto é mantida no seu 
              registro.
            </p>
            
            <p className="text-sm text-muted-foreground">
              <strong>Limite:</strong> Você pode enviar até 10 mensagens de voz por dia, 
              com duração máxima de 90 segundos cada.
            </p>
            
            <p className="text-sm text-muted-foreground">
              Você pode revogar este consentimento a qualquer momento nas configurações.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Não agora
          </Button>
          <Button
            onClick={handleConsent}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Registrando...' : 'Aceitar e Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
