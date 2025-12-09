import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Edit, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MoodEditorProps {
  recordId: string;
  currentMood: number;
  onUpdate: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

const MoodEditor: React.FC<MoodEditorProps> = ({ 
  recordId, 
  currentMood, 
  onUpdate, 
  isEditing, 
  onToggleEdit 
}) => {
  const { toast } = useToast();
  const [mood, setMood] = useState([currentMood]);
  const [saving, setSaving] = useState(false);

  const getMoodLabel = (level: number) => {
    if (level <= 2) return 'Muito baixo';
    if (level <= 4) return 'Baixo';
    if (level <= 6) return 'Neutro';
    if (level <= 8) return 'Bom';
    return 'Excelente';
  };

  const getMoodColor = (level: number) => {
    if (level <= 3) return 'text-health-danger';
    if (level <= 6) return 'text-health-warning';
    return 'text-health-success';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('daily_records')
        .update({ humor: mood[0].toString() as any })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Humor atualizado!",
        description: "O registro foi atualizado com sucesso."
      });

      onUpdate();
      onToggleEdit();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMood([currentMood]);
    onToggleEdit();
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Heart className={`h-4 w-4 ${getMoodColor(currentMood)}`} />
          <span className="text-sm font-medium">Humor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={`text-lg font-bold ${getMoodColor(currentMood)}`}>
              {currentMood}/10
            </div>
            <div className="text-xs text-muted-foreground">
              {getMoodLabel(currentMood)}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleEdit}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Editar Humor</CardTitle>
        <CardDescription>Ajuste seu nível de humor para este dia</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Humor (1-10): {getMoodLabel(mood[0])}</Label>
          <Slider
            value={mood}
            onValueChange={setMood}
            max={10}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Muito baixo</span>
            <span>Excelente</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            <Check className="h-3 w-3 mr-1" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="flex-1"
          >
            <X className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MoodEditor;