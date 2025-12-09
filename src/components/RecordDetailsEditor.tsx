import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RecordDetailsEditorProps {
  recordId: string;
  patientId: string;
  initialEnergia?: number;
  initialSleepHours?: number;
  initialComoSeSentiu?: string | null;
  initialGatilhos?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const RecordDetailsEditor: React.FC<RecordDetailsEditorProps> = ({
  recordId,
  patientId,
  initialEnergia,
  initialSleepHours,
  initialComoSeSentiu,
  initialGatilhos,
  onSaved,
  onCancel,
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [energia, setEnergia] = useState<number[]>([typeof initialEnergia === 'number' ? initialEnergia : 5]);
  const [sleepHours, setSleepHours] = useState<number[]>([typeof initialSleepHours === 'number' ? initialSleepHours : 8]);
  const [comoSeSentiu, setComoSeSentiu] = useState<string>(initialComoSeSentiu ?? '');
  const [gatilhos, setGatilhos] = useState<string>(initialGatilhos ?? '');

  const handleSave = async () => {
    try {
      setSaving(true);
      const updates = {
        energia: energia[0],
        sleep_hours: sleepHours[0],
        como_se_sentiu: comoSeSentiu,
        gatilhos: gatilhos,
      };

      const { error } = await supabase
        .from('daily_records')
        .update(updates)
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;

      // Reexecuta análise de alertas com IA quando houver texto
      const textToAnalyze = `${comoSeSentiu || ''} ${gatilhos || ''}`.trim();
      if (textToAnalyze) {
        try {
          const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-record-alerts', {
            body: {
              recordId,
              patientText: textToAnalyze,
              patientId,
            },
          });

          if (analysisError) {
            console.error('Erro na reanálise de alertas:', analysisError);
          } else if (analysisResult?.alertCreated) {
            toast({
              title: 'Análise de segurança atualizada',
              description: 'Seu registro foi reanalisado para garantir seu bem-estar.',
            });
          }
        } catch (analysisErr) {
          console.error('Erro ao processar reanálise:', analysisErr);
        }
      }

      toast({ title: 'Registro atualizado', description: 'As alterações foram salvas com sucesso.' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar alterações', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar detalhes do registro</CardTitle>
        <CardDescription>Atualize energia, sono e suas anotações do dia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Energia (1-10)</Label>
          <Slider
            value={energia}
            onValueChange={setEnergia}
            max={10}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">Nível atual: {energia[0]}</div>
        </div>

        <div className="space-y-2">
          <Label>Horas de sono</Label>
          <Slider
            value={sleepHours}
            onValueChange={setSleepHours}
            max={12}
            min={3}
            step={0.5}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">Nível atual: {sleepHours[0]}h</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="como-se-sentiu">Como se sentiu</Label>
          <Textarea
            id="como-se-sentiu"
            placeholder="Descreva como foi seu dia, seus sentimentos..."
            value={comoSeSentiu}
            onChange={(e) => setComoSeSentiu(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gatilhos">Gatilhos ou eventos importantes</Label>
          <Textarea
            id="gatilhos"
            placeholder="Houve algum evento ou situação que afetou seu humor?"
            value={gatilhos}
            onChange={(e) => setGatilhos(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecordDetailsEditor;
