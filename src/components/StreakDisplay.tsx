import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Calendar, TrendingUp } from 'lucide-react';

interface StreakDisplayProps {
  currentStreak: number;
  weekProgress: number;
  totalRecords: number;
}

const StreakDisplay: React.FC<StreakDisplayProps> = ({ currentStreak, weekProgress, totalRecords }) => {
  const getStreakMessage = () => {
    if (currentStreak === 0) return "Comece sua jornada hoje!";
    if (currentStreak === 1) return "Primeiro passo dado!";
    if (currentStreak < 7) return `${currentStreak} dias seguidos!`;
    if (currentStreak === 7) return "Uma semana completa! 🎉";
    return `${currentStreak} dias consecutivos!`;
  };

  const getWeekMessage = () => {
    const daysLeft = 7 - weekProgress;
    if (weekProgress === 7) return "Semana completa! Parabéns! 🎊";
    if (weekProgress === 0) return "Comece sua semana com força!";
    if (daysLeft === 1) return "Só falta 1 dia para completar!";
    return `Faltam ${daysLeft} dias esta semana`;
  };

  return (
    <Card className="shadow-md border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-orange-500" />
          Seu Progresso
        </CardTitle>
        <CardDescription>Continue mantendo sua constância</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">{currentStreak}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Flame className="h-3 w-3" />
              dias seguidos
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{weekProgress}/7</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              esta semana
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">{totalRecords}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              total
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso semanal</span>
            <span className="font-medium">{Math.round((weekProgress / 7) * 100)}%</span>
          </div>
          <Progress value={(weekProgress / 7) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{getWeekMessage()}</p>
        </div>

        <div className="bg-primary/5 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-primary">{getStreakMessage()}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StreakDisplay;
