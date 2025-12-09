import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarConnection {
  id: string;
  provider: string;
  provider_email: string;
  connected_at: string;
  expires_at: string;
}

export const GoogleCalendarConnect: React.FC = () => {
  const { user } = useAuth();
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  useEffect(() => {
    checkExistingConnection();
  }, [user]);

  const checkExistingConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();

      if (error) {
        console.error('Error checking connection:', error);
        return;
      }

      setConnection(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get auth URL
      const { data: authData, error: authError } = await supabase.functions.invoke(
        'google-calendar-auth',
        {
          body: { action: 'getAuthUrl' }
        }
      );

      if (authError) {
        throw authError;
      }

      // Open auth URL in new window
      const authWindow = window.open(
        authData.authUrl,
        'google-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        throw new Error('Failed to open authentication window');
      }

      // Listen for auth completion
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed);
          // Check if connection was successful
          setTimeout(() => {
            checkExistingConnection();
          }, 1000);
        }
      }, 1000);

      // Handle message from auth window
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.code) {
          authWindow.close();
          
          // Exchange code for tokens
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
            'google-calendar-auth',
            {
              body: { 
                action: 'exchangeCode',
                code: event.data.code,
                userId: user.id
              }
            }
          );

          if (tokenError) {
            throw tokenError;
          }

          toast.success('Google Calendar conectado com sucesso!');
          checkExistingConnection();
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
        if (!authWindow.closed) {
          authWindow.close();
        }
      }, 300000); // 5 minutes timeout

    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Erro ao conectar com Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !connection) return;

    try {
      const { error } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('id', connection.id);

      if (error) {
        throw error;
      }

      setConnection(null);
      toast.success('Google Calendar desconectado');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar Google Calendar');
    }
  };

  if (checkingConnection) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isExpired = connection && new Date(connection.expires_at) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Conecte sua conta Google para sincronizar compromissos automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpired ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-success" />
                )}
                <span className="font-medium">{connection.provider_email}</span>
              </div>
              <Badge variant={isExpired ? "destructive" : "default"}>
                {isExpired ? 'Expirado' : 'Conectado'}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Conectado em: {new Date(connection.connected_at).toLocaleDateString('pt-BR')}
            </div>
            
            {isExpired && (
              <div className="text-sm text-destructive">
                A conexão expirou. Reconecte para continuar sincronizando.
              </div>
            )}

            <div className="flex gap-2">
              {isExpired && (
                <Button onClick={handleConnect} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reconectar
                </Button>
              )}
              <Button variant="outline" onClick={handleDisconnect}>
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta conectada. Conecte seu Google Calendar para sincronizar compromissos.
            </p>
            <Button onClick={handleConnect} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conectar Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};