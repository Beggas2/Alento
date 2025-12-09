import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/Layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Registros from "./pages/Registros";
import Pacientes from "./pages/Pacientes";
import Alertas from "./pages/Alertas";
import Calendario from "./pages/Calendario";
import Estatisticas from "./pages/Estatisticas";
import Configuracoes from "./pages/Configuracoes";
import Medicamentos from "./pages/Medicamentos";
import Mensagens from "./pages/Mensagens";
import AnaliseComparativa from "./pages/AnaliseComparativa";
import Chatbot from "./pages/Chatbot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <AppLayout>
                <Index />
              </AppLayout>
            } />
            <Route path="/registros" element={
              <AppLayout>
                <Registros />
              </AppLayout>
            } />
            <Route path="/pacientes" element={
              <AppLayout>
                <Pacientes />
              </AppLayout>
            } />
            <Route path="/alertas" element={
              <AppLayout>
                <Alertas />
              </AppLayout>
            } />
            <Route path="/calendario" element={
              <AppLayout>
                <Calendario />
              </AppLayout>
            } />
            <Route path="/estatisticas" element={
              <AppLayout>
                <Estatisticas />
              </AppLayout>
            } />
            <Route path="/configuracoes" element={
              <AppLayout>
                <Configuracoes />
              </AppLayout>
            } />
            <Route path="/medicamentos" element={
              <AppLayout>
                <Medicamentos />
              </AppLayout>
            } />
            <Route path="/mensagens" element={
              <AppLayout>
                <Mensagens />
              </AppLayout>
            } />
            <Route path="/analise-comparativa" element={
              <AppLayout>
                <AnaliseComparativa />
              </AppLayout>
            } />
            <Route path="/chatbot" element={
              <AppLayout>
                <Chatbot />
              </AppLayout>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
