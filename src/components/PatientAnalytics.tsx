import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePatientAnalytics } from '@/hooks/usePatientAnalytics';

interface PatientAnalyticsProps {
  patientId: string;
  patientName: string;
}

const PatientAnalytics: React.FC<PatientAnalyticsProps> = ({ patientId, patientName }) => {
  const [timeWindow, setTimeWindow] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const { correlations, timeSeriesData, insights, loading, error, fetchAnalyticsData } = usePatientAnalytics(patientId);

  useEffect(() => {
    const startDate = customStartDate ? new Date(customStartDate) : undefined;
    const endDate = customEndDate ? new Date(customEndDate) : undefined;
    fetchAnalyticsData(timeWindow, startDate, endDate);
  }, [patientId, timeWindow, customStartDate, customEndDate, fetchAnalyticsData]);

  const handleTimeWindowChange = (value: string) => {
    setTimeWindow(value as '7' | '30' | '90' | 'custom');
    if (value !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const getCorrelationColor = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'text-red-600';
    if (abs >= 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStrengthBadge = (strength: string) => {
    const variants = {
      strong: 'destructive',
      moderate: 'default',
      weak: 'secondary'
    } as const;
    
    return <Badge variant={variants[strength]}>{strength === 'strong' ? 'Forte' : strength === 'moderate' ? 'Moderada' : 'Fraca'}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Carregando análise...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Erro ao carregar dados: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise de Correlações - {patientName}
          </CardTitle>
          <CardDescription>
            Correlações entre variáveis rastreadas nos últimos {timeWindow} dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <Select value={timeWindow} onValueChange={handleTimeWindowChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="custom">Período customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {timeWindow === 'custom' && (
              <div className="flex gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="start-date">Data Inicial</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="end-date">Data Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {correlations.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                Dados insuficientes para análise de correlações (mínimo 10 registros)
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {correlations.map((corr, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">
                          {corr.variable1} ↔ {corr.variable2}
                        </h4>
                        {getStrengthBadge(corr.strength)}
                        {corr.direction === 'positive' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {corr.interpretation}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>r = {corr.correlation.toFixed(3)}</span>
                        <span>p = {corr.pValue.toFixed(3)}</span>
                        <span>n = {corr.sampleSize}</span>
                        {corr.confidenceInterval && (
                          <span>
                            CI: [{corr.confidenceInterval[0].toFixed(2)}, {corr.confidenceInterval[1].toFixed(2)}]
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${getCorrelationColor(corr.correlation)}`}>
                      {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(2)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {timeSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendências ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#8884d8" name="Humor" />
                <Line type="monotone" dataKey="energy" stroke="#82ca9d" name="Energia" />
                <Line type="monotone" dataKey="sleep" stroke="#ffc658" name="Sono" />
                <Line type="monotone" dataKey="medication_adherence" stroke="#ff7300" name="Aderência %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Insights e Recomendações
            </CardTitle>
            <CardDescription>
              Análises automáticas baseadas nos dados do paciente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {insights.map((insight, index) => (
                <Card key={index} className={`p-4 border-l-4 ${
                  insight.severity === 'high' ? 'border-l-red-500' :
                  insight.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`h-5 w-5 mt-0.5 ${
                      insight.severity === 'high' ? 'text-red-500' :
                      insight.severity === 'medium' ? 'text-yellow-500' : 'text-green-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                      {insight.recommendation && (
                        <p className="text-xs text-blue-600 font-medium">
                          💡 {insight.recommendation}
                        </p>
                      )}
                    </div>
                    <Badge variant={insight.severity === 'high' ? 'destructive' : 'default'}>
                      {insight.type}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PatientAnalytics;