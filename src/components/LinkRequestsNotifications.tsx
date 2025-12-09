import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_type: string;
  target_type: string;
  status: string;
  message?: string;
  created_at: string;
  requester_profile?: {
    nome: string;
    codigo: string;
    especialidade?: string;
  } | null;
}

export const LinkRequestsNotifications = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchLinkRequests();
    }
  }, [profile?.id]);

  const fetchLinkRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('link_requests')
        .select(`
          *,
          requester_profile:profiles!link_requests_requester_id_fkey(nome, codigo, especialidade)
        `)
        .eq('target_id', profile?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar solicitações:', error);
        return;
      }

      const formattedRequests = data?.map(request => ({
        ...request,
        requester_profile: Array.isArray(request.requester_profile) 
          ? request.requester_profile[0] 
          : request.requester_profile
      })) || [];

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      const { data, error } = await supabase.rpc('process_link_request', {
        request_id: requestId,
        action: action
      });

      if (error) {
        console.error('Erro ao processar solicitação:', error);
        toast({
          title: "Erro",
          description: "Não foi possível processar a solicitação",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: action === 'accepted' ? "Solicitação aceita!" : "Solicitação rejeitada",
        description: action === 'accepted' 
          ? "Agora vocês estão vinculados" 
          : "A solicitação foi rejeitada",
        variant: "default"
      });

      // Atualizar a lista
      fetchLinkRequests();
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a solicitação",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Solicitações de Vinculação
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {request.requester_profile?.nome || 'Usuário não encontrado'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Código: {request.requester_profile?.codigo || 'N/A'}
                  {request.requester_profile?.especialidade && (
                    <span className="ml-2">
                      ({request.requester_profile.especialidade === 'medico' ? 'Médico' : 'Psicólogo'})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.requester_type === 'profissional' 
                    ? 'Quer acompanhar você como paciente' 
                    : 'Quer ser acompanhado por você'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleRequest(request.id, 'accepted')}
                className="bg-health-success hover:bg-health-success/90"
              >
                <Check className="h-4 w-4" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequest(request.id, 'rejected')}
                className="border-health-danger text-health-danger hover:bg-health-danger/10"
              >
                <X className="h-4 w-4" />
                Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};