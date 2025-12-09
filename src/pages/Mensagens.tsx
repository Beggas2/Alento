import React from 'react';
import { MessagingInbox } from '@/components/MessagingInbox';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/Layout/AppSidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';

export default function Mensagens() {
  const isMobile = useIsMobile();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {isMobile && (
            <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-bold">Mensagens</h1>
              </div>
            </div>
          )}
          
          {!isMobile && (
            <div className="px-6 py-4 border-b">
              <h1 className="text-2xl font-bold">Mensagens</h1>
              <p className="text-sm text-muted-foreground">
                Comunicação segura entre pacientes e profissionais
              </p>
            </div>
          )}
          
          <div className="flex-1 p-6 overflow-hidden">
            <MessagingInbox />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}