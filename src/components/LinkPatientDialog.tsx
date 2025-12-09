import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkPatientDialogProps {
  onSuccess?: () => void;
}

export const LinkPatientDialog = ({ onSuccess }: LinkPatientDialogProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [patientCode, setPatientCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  const searchPatient = async () => {
    if (!patientCode.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_patient_by_code', {
        patient_code: patientCode.toUpperCase()
      });

      if (error) {
        console.error('Erro ao buscar paciente:', error);
        toast({
          title: "Erro",
          description: "Erro ao buscar paciente",
          variant: "destructive"
        });
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Paciente não encontrado",
          description: "Nenhum paciente encontrado com este código",
          variant: "destructive"
        });
        setSearchResult(null);
        return;
      }

      setSearchResult(data[0]);
    } catch (error) {
      console.error('Erro ao buscar paciente:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar paciente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendLinkRequest = async () => {
    if (!searchResult || !profile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('link_requests')
        .insert({
          requester_id: profile.id,
          target_id: searchResult.id,
          requester_type: 'profissional',
          target_type: 'paciente',
          message: message.trim() || `Olá! Sou ${profile.nome} e gostaria de acompanhar seu tratamento.`
        });

      if (error) {
        console.error('Erro ao enviar solicitação:', error);
        toast({
          title: "Erro",
          description: "Erro ao enviar solicitação de vinculação",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Solicitação enviada!",
        description: `Solicitação de vinculação enviada para ${searchResult.nome}`,
        variant: "default"
      });

      // Reset form
      setPatientCode('');
      setMessage('');
      setSearchResult(null);
      setIsOpen(false);
      onSuccess?.();

    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação de vinculação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Vincular Paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Paciente</DialogTitle>
          <DialogDescription>
            Digite o código do paciente para enviar uma solicitação de vinculação
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient-code">Código do Paciente</Label>
            <div className="flex gap-2">
              <Input
                id="patient-code"
                placeholder="PC000001"
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={searchPatient}
                disabled={loading || !patientCode.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {searchResult && (
            <div className="p-3 bg-accent rounded-lg">
              <p className="font-medium">{searchResult.nome}</p>
              <p className="text-sm text-muted-foreground">Código: {searchResult.codigo}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              placeholder="Deixe uma mensagem para o paciente..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={sendLinkRequest}
            disabled={loading || !searchResult}
          >
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};