import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/Layout/AppLayout';
import { PatientChatbot } from '@/components/PatientChatbot';
import { BotKnowledgeManager } from '@/components/BotKnowledgeManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bot, FileText } from 'lucide-react';

export default function Chatbot() {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header com botão de menu */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-start gap-4">
              <SidebarTrigger className="mt-1" />
              <div className="bg-primary/10 p-3 rounded-xl">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">Nala</h1>
                <p className="text-muted-foreground text-base">
                  {profile?.tipo === 'profissional' 
                    ? 'Gerencie o conhecimento e monitore interações da Nala'
                    : 'Converse com a Nala, sua assistente virtual para apoio e orientação'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">

          {profile?.tipo === 'profissional' ? (
            <Tabs defaultValue="knowledge" className="container mx-auto px-6 py-6">
              <TabsList className="mb-6">
                <TabsTrigger value="knowledge" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Base de Conhecimento
                </TabsTrigger>
                <TabsTrigger value="test" className="gap-2">
                  <Bot className="h-4 w-4" />
                  Testar Chatbot
                </TabsTrigger>
              </TabsList>
              <TabsContent value="knowledge">
                <BotKnowledgeManager />
              </TabsContent>
              <TabsContent value="test">
                <PatientChatbot />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="container mx-auto px-6 py-6">
              <PatientChatbot />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}