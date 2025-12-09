import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Stethoscope, Building2, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ProfessionalProfile {
  id: string;
  nome: string;
  especialidade: string | null;
  codigo: string;
  is_medico: boolean;
  crp_crm: string | null;
  telefone: string | null;
  email: string | null;
  clinica: string | null;
  endereco: string | null;
  bio: string | null;
  foto_perfil_url: string | null;
  logo_clinica_url: string | null;
}

interface ProfessionalProfileDialogProps {
  professional: ProfessionalProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfessionalProfileDialog: React.FC<ProfessionalProfileDialogProps> = ({
  professional,
  open,
  onOpenChange,
}) => {
  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={professional.foto_perfil_url || undefined} />
              <AvatarFallback className="bg-primary/10">
                {professional.is_medico ? (
                  <Stethoscope className="h-8 w-8 text-primary" />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{professional.nome}</h2>
              <Badge variant={professional.is_medico ? "default" : "secondary"} className="mt-1">
                {professional.is_medico ? "Médico" : "Psicólogo"}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Especialidade */}
          {professional.especialidade && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Especialidade</h3>
              <p className="text-base">{professional.especialidade}</p>
            </div>
          )}

          <Separator />

          {/* Informações Profissionais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Profissionais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {professional.is_medico ? 'CRM' : 'CRP'}
                  </p>
                  <p className="text-base">
                    {professional.crp_crm || 'Não informado'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Código</p>
                  <p className="text-base font-mono">{professional.codigo}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Clínica/Local de Atendimento */}
          {(professional.clinica || professional.endereco || professional.logo_clinica_url) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Local de Atendimento</h3>
                
                {professional.logo_clinica_url && (
                  <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
                    <img 
                      src={professional.logo_clinica_url} 
                      alt="Logo da clínica" 
                      className="max-h-24 object-contain"
                    />
                  </div>
                )}

                {professional.clinica && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Clínica</p>
                      <p className="text-base">{professional.clinica}</p>
                    </div>
                  </div>
                )}

                {professional.endereco && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                      <p className="text-base">{professional.endereco}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Contato */}
          {(professional.telefone || professional.email) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Contato</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {professional.telefone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                        <p className="text-base">{professional.telefone}</p>
                      </div>
                    </div>
                  )}

                  {professional.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                        <p className="text-base break-all">{professional.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Biografia */}
          {professional.bio && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Sobre</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {professional.bio}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
