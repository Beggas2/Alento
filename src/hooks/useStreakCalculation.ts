import { useMemo } from 'react';

interface DailyRecord {
  created_at: string;
  data: string;
}

interface StreakData {
  currentStreak: number;
  weekProgress: number;
}

export const useStreakCalculation = (records: DailyRecord[]): StreakData => {
  return useMemo(() => {
    if (records.length === 0) {
      return { currentStreak: 0, weekProgress: 0 };
    }

    // Ordenar por data mais recente
    const sortedRecords = [...records].sort((a, b) => 
      new Date(b.data).getTime() - new Date(a.data).getTime()
    );

    // Calcular streak atual
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let checkDate = new Date(today);
    
    for (const record of sortedRecords) {
      const recordDate = new Date(record.data);
      recordDate.setHours(0, 0, 0, 0);
      
      if (recordDate.getTime() === checkDate.getTime()) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (recordDate.getTime() < checkDate.getTime()) {
        // Se não tem registro para este dia, streak quebrada
        break;
      }
    }

    // Calcular progresso da semana (últimos 7 dias)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weekRecords = sortedRecords.filter(record => {
      const recordDate = new Date(record.data);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate >= sevenDaysAgo && recordDate <= today;
    });

    // Contar dias únicos na semana
    const uniqueDays = new Set(
      weekRecords.map(r => new Date(r.data).toISOString().split('T')[0])
    );
    
    const weekProgress = uniqueDays.size;

    return { currentStreak, weekProgress };
  }, [records]);
};
