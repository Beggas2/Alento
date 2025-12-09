import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, TrendingDown, Moon, Zap } from 'lucide-react';

interface Insight {
  type: 'sleep' | 'energy' | 'mood' | 'general';
  message: string;
  trend?: 'up' | 'down';
}

interface InsightsCardProps {
  insights: Insight[];
}

const InsightsCard: React.FC<InsightsCardProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'sleep': return <Moon className="h-4 w-4" />;
      case 'energy': return <Zap className="h-4 w-4" />;
      case 'mood': return <TrendingUp className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down') => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-health-success" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-health-warning" />;
    return null;
  };

  return (
    <Card className="shadow-md border-l-4 border-l-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-secondary" />
          Insights Automáticos
        </CardTitle>
        <CardDescription>Padrões identificados nos seus registros</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 bg-secondary/5 rounded-lg hover:bg-secondary/10 transition-colors"
          >
            <div className="text-secondary mt-0.5">
              {getIcon(insight.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{insight.message}</p>
            </div>
            {insight.trend && (
              <div className="mt-0.5">
                {getTrendIcon(insight.trend)}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default InsightsCard;
