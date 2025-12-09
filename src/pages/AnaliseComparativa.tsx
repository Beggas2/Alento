import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import MultiPatientAnalytics from '@/components/MultiPatientAnalytics';

const AnaliseComparativa: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <SidebarTrigger />
          <div className="ml-4">
            <h2 className="font-semibold text-foreground">Análise Comparativa</h2>
            <p className="text-xs text-muted-foreground">
              Compare métricas entre múltiplos pacientes
            </p>
          </div>
        </div>
      </header>
      
      <div className="p-6">
        <MultiPatientAnalytics />
      </div>
    </div>
  );
};

export default AnaliseComparativa;