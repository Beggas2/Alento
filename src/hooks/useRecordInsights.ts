import { useMemo } from 'react';

interface DailyRecord {
  id: string;
  humor: string;
  energia?: number;
  sleep_hours?: number;
  created_at: string;
}

interface Insight {
  type: 'sleep' | 'energy' | 'mood' | 'general';
  message: string;
  trend?: 'up' | 'down';
}

export const useRecordInsights = (records: DailyRecord[]): Insight[] => {
  return useMemo(() => {
    const insights: Insight[] = [];
    
    if (records.length < 3) return insights;

    const recent = records.slice(0, 7);
    const older = records.slice(7, 14);

    // Insight sobre sono
    const recentSleep = recent.filter(r => r.sleep_hours).map(r => r.sleep_hours!);
    const olderSleep = older.filter(r => r.sleep_hours).map(r => r.sleep_hours!);
    
    if (recentSleep.length >= 3) {
      const recentAvg = recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length;
      const olderAvg = olderSleep.length > 0 
        ? olderSleep.reduce((a, b) => a + b, 0) / olderSleep.length 
        : recentAvg;
      
      const diff = recentAvg - olderAvg;
      
      if (Math.abs(diff) >= 1) {
        insights.push({
          type: 'sleep',
          message: `Seu sono ${diff > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(diff).toFixed(1)}h nos últimos dias.`,
          trend: diff > 0 ? 'up' : 'down'
        });
      }

      // Correlação sono-energia
      const sleepEnergyPairs = recent
        .filter(r => r.sleep_hours && r.energia)
        .map(r => ({ sleep: r.sleep_hours!, energy: r.energia! }));
      
      if (sleepEnergyPairs.length >= 3) {
        const highSleep = sleepEnergyPairs.filter(p => p.sleep >= 7);
        const lowSleep = sleepEnergyPairs.filter(p => p.sleep < 6);
        
        if (highSleep.length >= 2 && lowSleep.length >= 2) {
          const highSleepEnergy = highSleep.reduce((a, b) => a + b.energy, 0) / highSleep.length;
          const lowSleepEnergy = lowSleep.reduce((a, b) => a + b.energy, 0) / lowSleep.length;
          
          if (highSleepEnergy - lowSleepEnergy >= 1.5) {
            insights.push({
              type: 'energy',
              message: 'Você tem mais energia quando dorme 7h ou mais.',
              trend: 'up'
            });
          }
        }
      }
    }

    // Insight sobre energia
    const recentEnergy = recent.filter(r => r.energia).map(r => r.energia!);
    const olderEnergy = older.filter(r => r.energia).map(r => r.energia!);
    
    if (recentEnergy.length >= 3) {
      const recentAvg = recentEnergy.reduce((a, b) => a + b, 0) / recentEnergy.length;
      const olderAvg = olderEnergy.length > 0 
        ? olderEnergy.reduce((a, b) => a + b, 0) / olderEnergy.length 
        : recentAvg;
      
      const diff = recentAvg - olderAvg;
      
      if (Math.abs(diff) >= 1.5) {
        insights.push({
          type: 'energy',
          message: `Sua energia está ${diff > 0 ? 'aumentando' : 'diminuindo'} nas últimas semanas.`,
          trend: diff > 0 ? 'up' : 'down'
        });
      }
    }

    // Insight sobre humor
    const recentMood = recent.map(r => parseInt(r.humor));
    const olderMood = older.map(r => parseInt(r.humor));
    
    if (recentMood.length >= 3) {
      const recentAvg = recentMood.reduce((a, b) => a + b, 0) / recentMood.length;
      const olderAvg = olderMood.length > 0 
        ? olderMood.reduce((a, b) => a + b, 0) / olderMood.length 
        : recentAvg;
      
      const diff = recentAvg - olderAvg;
      
      if (Math.abs(diff) >= 1.5) {
        insights.push({
          type: 'mood',
          message: `Seu humor está ${diff > 0 ? 'melhorando' : 'precisando de atenção'} ultimamente.`,
          trend: diff > 0 ? 'up' : 'down'
        });
      }

      // Consistência
      const variance = recentMood.reduce((sum, val) => {
        return sum + Math.pow(val - recentAvg, 2);
      }, 0) / recentMood.length;
      
      if (variance < 2) {
        insights.push({
          type: 'general',
          message: 'Você manteve estabilidade emocional esta semana!',
          trend: 'up'
        });
      }
    }

    return insights;
  }, [records]);
};
