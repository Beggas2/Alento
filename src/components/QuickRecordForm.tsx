import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface QuickRecordFormProps {
  onSubmit: (data: {
    humor: number;
    energia: number;
    sleep_hours: number;
    como_se_sentiu: string;
    gatilhos: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const QuickRecordForm: React.FC<QuickRecordFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    humor: [5],
    energia: [5],
    sleep_hours: [8],
    como_se_sentiu: '',
    gatilhos: ''
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getMoodLabel = (level: number) => {
    if (level <= 2) return 'Muito baixo';
    if (level <= 4) return 'Baixo';
    if (level <= 6) return 'Neutro';
    if (level <= 8) return 'Bom';
    return 'Excelente';
  };

  const handleQuickEnergy = (level: 'baixa' | 'media' | 'alta') => {
    const values = { baixa: 3, media: 6, alta: 9 };
    setFormData(prev => ({ ...prev, energia: [values[level]] }));
  };

  const handleQuickSleep = (hours: 4 | 6 | 8) => {
    setFormData(prev => ({ ...prev, sleep_hours: [hours] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        humor: formData.humor[0],
        energia: formData.energia[0],
        sleep_hours: formData.sleep_hours[0],
        como_se_sentiu: formData.como_se_sentiu,
        gatilhos: formData.gatilhos
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Heart className="h-5 w-5 text-primary" />
          Registro Rápido
        </CardTitle>
        <CardDescription>Leva menos de 10 segundos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Humor */}
          <div className="space-y-2">
            <Label className="text-base">Como está seu humor?</Label>
            <Slider
              value={formData.humor}
              onValueChange={(value) => setFormData(prev => ({ ...prev, humor: value }))}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="text-center">
              <span className="text-2xl font-semibold text-primary">{formData.humor[0]}</span>
              <span className="text-sm text-muted-foreground ml-2">{getMoodLabel(formData.humor[0])}</span>
            </div>
          </div>

          {/* Energia - Botões Rápidos */}
          <div className="space-y-2">
            <Label className="text-base">Energia</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.energia[0] <= 4 ? "default" : "outline"}
                onClick={() => handleQuickEnergy('baixa')}
                className="h-12"
              >
                Baixa
              </Button>
              <Button
                type="button"
                variant={formData.energia[0] > 4 && formData.energia[0] <= 7 ? "default" : "outline"}
                onClick={() => handleQuickEnergy('media')}
                className="h-12"
              >
                Média
              </Button>
              <Button
                type="button"
                variant={formData.energia[0] > 7 ? "default" : "outline"}
                onClick={() => handleQuickEnergy('alta')}
                className="h-12"
              >
                Alta
              </Button>
            </div>
            <Slider
              value={formData.energia}
              onValueChange={(value) => setFormData(prev => ({ ...prev, energia: value }))}
              max={10}
              min={1}
              step={1}
              className="w-full mt-2"
            />
          </div>

          {/* Sono - Botões Rápidos */}
          <div className="space-y-2">
            <Label className="text-base">Horas de sono</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.sleep_hours[0] === 4 ? "default" : "outline"}
                onClick={() => handleQuickSleep(4)}
                className="h-12"
              >
                4h
              </Button>
              <Button
                type="button"
                variant={formData.sleep_hours[0] === 6 ? "default" : "outline"}
                onClick={() => handleQuickSleep(6)}
                className="h-12"
              >
                6h
              </Button>
              <Button
                type="button"
                variant={formData.sleep_hours[0] === 8 ? "default" : "outline"}
                onClick={() => handleQuickSleep(8)}
                className="h-12"
              >
                8h
              </Button>
            </div>
            <Slider
              value={formData.sleep_hours}
              onValueChange={(value) => setFormData(prev => ({ ...prev, sleep_hours: value }))}
              max={12}
              min={3}
              step={0.5}
              className="w-full mt-2"
            />
            <div className="text-center text-sm text-muted-foreground">
              {formData.sleep_hours[0]}h
            </div>
          </div>

          {/* Campos Colapsáveis */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span>Adicionar detalhes (opcional)</span>
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="como_se_sentiu">Como se sentiu?</Label>
                <Textarea
                  id="como_se_sentiu"
                  placeholder="Descreva seu dia..."
                  value={formData.como_se_sentiu}
                  onChange={(e) => setFormData(prev => ({ ...prev, como_se_sentiu: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gatilhos">Algo marcante?</Label>
                <Textarea
                  id="gatilhos"
                  placeholder="Eventos importantes..."
                  value={formData.gatilhos}
                  onChange={(e) => setFormData(prev => ({ ...prev, gatilhos: e.target.value }))}
                  rows={3}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar Registro'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuickRecordForm;
