import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Download, Users, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMultiPatientAnalytics, ComparisonFilters } from '@/hooks/useMultiPatientAnalytics';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const MultiPatientAnalytics: React.FC = () => {
  const [filters, setFilters] = useState<ComparisonFilters>({
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date()
    }
  });

  const {
    patientMetrics,
    cohortStats,
    loading,
    error,
    deIdentified,
    setDeIdentified,
    fetchMultiPatientData,
    exportData
  } = useMultiPatientAnalytics();

  const { toast } = useToast();

  const handleSearch = () => {
    fetchMultiPatientData(filters);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      await exportData(format, patientMetrics);
      toast({
        title: "Exportação realizada",
        description: `Dados exportados em formato ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      });
    }
  };

  const updateFilters = (key: keyof ComparisonFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getBoxPlotData = () => {
    return cohortStats.map(stat => ({
      metric: stat.metric,
      min: stat.min,
      q1: stat.q25,
      median: stat.median,
      q3: stat.q75,
      max: stat.max,
      count: stat.count
    }));
  };

  const getRiskTierColor = (count: number) => {
    if (count === 0) return 'bg-green-100 text-green-800';
    if (count <= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Análise Comparativa de Pacientes
          </h2>
          <p className="text-muted-foreground">
            Compare métricas de múltiplos pacientes com filtros e controles de privacidade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className={`h-4 w-4 ${deIdentified ? 'text-green-600' : 'text-orange-600'}`} />
          <Label htmlFor="de-identification">Dados anonimizados</Label>
          <Switch
            id="de-identification"
            checked={deIdentified}
            onCheckedChange={setDeIdentified}
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Comparação</CardTitle>
          <CardDescription>
            Configure os critérios para análise comparativa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Faixa Etária</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.ageRange?.[0] || ''}
                  onChange={(e) => updateFilters('ageRange', [
                    parseInt(e.target.value) || 0,
                    filters.ageRange?.[1] || 100
                  ])}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.ageRange?.[1] || ''}
                  onChange={(e) => updateFilters('ageRange', [
                    filters.ageRange?.[0] || 0,
                    parseInt(e.target.value) || 100
                  ])}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select
                value={filters.gender || 'all'}
                onValueChange={(value) => updateFilters('gender', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nível de Risco</Label>
              <Select
                value={filters.riskTier || 'all'}
                onValueChange={(value) => updateFilters('riskTier', value === 'all' ? 'all' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aderência</Label>
              <Select
                value={filters.adherenceLevel || 'all'}
                onValueChange={(value) => updateFilters('adherenceLevel', value === 'all' ? 'all' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Baixa (&lt;60%)</SelectItem>
                  <SelectItem value="medium">Média (60-80%)</SelectItem>
                  <SelectItem value="high">Alta (&gt;80%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={format(filters.dateRange.start, 'yyyy-MM-dd')}
                onChange={(e) => updateFilters('dateRange', {
                  ...filters.dateRange,
                  start: new Date(e.target.value)
                })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={format(filters.dateRange.end, 'yyyy-MM-dd')}
                onChange={(e) => updateFilters('dateRange', {
                  ...filters.dateRange,
                  end: new Date(e.target.value)
                })}
              />
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleSearch} disabled={loading} className="flex-1">
                {loading ? 'Analisando...' : 'Analisar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {patientMetrics.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Pacientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patientMetrics.length}</div>
                <p className="text-xs text-muted-foreground">
                  Analisados no período selecionado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertas de Crise</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {patientMetrics.reduce((sum, p) => sum + p.crisis_alerts_count, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de alertas registrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aderência Média</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(patientMetrics
                    .filter(p => p.medication_adherence_avg !== null)
                    .reduce((sum, p) => sum + (p.medication_adherence_avg || 0), 0) /
                    patientMetrics.filter(p => p.medication_adherence_avg !== null).length || 0
                  ).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Medicamentos na coorte
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cohort Overview - Box Plots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Visão Geral da Coorte
              </CardTitle>
              <CardDescription>
                Distribuição de métricas por percentis (Q1, Mediana, Q3)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="metric" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="median" fill="hsl(var(--primary))" name="Mediana" />
                    <Bar dataKey="mean" fill="hsl(var(--secondary))" name="Média" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Patient Comparison Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Comparação Detalhada</CardTitle>
                <CardDescription>
                  Métricas individuais por paciente
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Humor</TableHead>
                    <TableHead>Sono (h)</TableHead>
                    <TableHead>Energia</TableHead>
                    <TableHead>Aderência (%)</TableHead>
                    <TableHead>PHQ-9</TableHead>
                    <TableHead>GAD-7</TableHead>
                    <TableHead>Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientMetrics.map((patient) => (
                    <TableRow key={patient.patientId}>
                      <TableCell className="font-medium">
                        {patient.patientIdentifier}
                      </TableCell>
                      <TableCell>
                        {patient.mood_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        {patient.sleep_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        {patient.energy_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        {patient.medication_adherence_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        {patient.phq9_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        {patient.gad7_avg?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRiskTierColor(patient.crisis_alerts_count)}>
                          {patient.crisis_alerts_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Statistical Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo Estatístico</CardTitle>
              <CardDescription>
                Estatísticas descritivas da coorte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Média</TableHead>
                    <TableHead>Mediana</TableHead>
                    <TableHead>Q1</TableHead>
                    <TableHead>Q3</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>N</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohortStats.map((stat) => (
                    <TableRow key={stat.metric}>
                      <TableCell className="font-medium">{stat.metric}</TableCell>
                      <TableCell>{stat.mean}</TableCell>
                      <TableCell>{stat.median}</TableCell>
                      <TableCell>{stat.q25}</TableCell>
                      <TableCell>{stat.q75}</TableCell>
                      <TableCell>{stat.min}</TableCell>
                      <TableCell>{stat.max}</TableCell>
                      <TableCell>{stat.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MultiPatientAnalytics;