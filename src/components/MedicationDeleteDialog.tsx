import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2, Archive } from 'lucide-react';

interface MedicationDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  medicationId: string;
  medicationName: string;
  onDelete: () => void;
}

type DeleteType = 'complete' | 'soft';

const MedicationDeleteDialog: React.FC<MedicationDeleteDialogProps> = ({
  isOpen,
  onClose,
  medicationId,
  medicationName,
  onDelete
}) => {
  const { toast } = useToast();
  const [deleteType, setDeleteType] = useState<DeleteType>('soft');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (deleteType === 'complete') {
        // Excluir completamente - desativar medicamento e remover todos os registros
        const { error: medicationError } = await supabase
          .from('medications')
          .update({ ativo: false })
          .eq('id', medicationId);

        if (medicationError) throw medicationError;

        // Remover todos os registros de tomada
        const { error: intakeError } = await supabase
          .from('medication_intakes')
          .delete()
          .eq('medication_id', medicationId);

        if (intakeError) throw intakeError;

        toast({
          title: "Medicamento excluído",
          description: "O medicamento e todos os registros foram removidos completamente.",
        });
      } else {
        // Desprescrição - apenas desativar o medicamento mantendo histórico
        const { error } = await supabase
          .from('medications')
          .update({ 
            ativo: false,
            data_fim: new Date().toISOString().split('T')[0] // Data de fim como hoje
          })
          .eq('id', medicationId);

        if (error) throw error;

        toast({
          title: "Medicamento desprescrito",
          description: "O medicamento foi desprescrito. O histórico de tomadas foi mantido.",
        });
      }

      onDelete();
      onClose();
    } catch (error) {
      console.error('Erro ao excluir medicamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar a operação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-health-danger" />
            Excluir Medicamento
          </DialogTitle>
          <DialogDescription>
            Como você deseja proceder com o medicamento "{medicationName}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={deleteType} onValueChange={(value) => setDeleteType(value as DeleteType)}>
            <div className="flex items-center space-x-2 p-3 border rounded-lg">
              <RadioGroupItem value="soft" id="soft" />
              <Label htmlFor="soft" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Desprescrever</p>
                    <p className="text-sm text-muted-foreground">
                      Remove da lista ativa mas mantém o histórico de tomadas
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg">
              <RadioGroupItem value="complete" id="complete" />
              <Label htmlFor="complete" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Excluir completamente</p>
                    <p className="text-sm text-muted-foreground">
                      Remove o medicamento e todo o histórico de tomadas
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={loading}
          >
            {loading ? 'Processando...' : deleteType === 'complete' ? 'Excluir Tudo' : 'Desprescrever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MedicationDeleteDialog;