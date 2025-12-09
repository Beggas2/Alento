import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { Settings, User, Phone, CreditCard, AlertTriangle, Lock, Copy, Check, Building2, MapPin, Upload } from 'lucide-react';
import { GoogleCalendarConnect } from '@/components/GoogleCalendarConnect';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const Configuracoes = () => {
  const { profile, updateProfile, deleteAccount } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    nome: profile?.nome || '',
    telefone: profile?.telefone || '',
    crp_crm: profile?.crp_crm || '',
    especialidade: profile?.especialidade || '',
    clinica: profile?.clinica || '',
    endereco: profile?.endereco || '',
    bio: profile?.bio || ''
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [logoClinica, setLogoClinica] = useState<File | null>(null);
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState<string | null>(profile?.foto_perfil_url || null);
  const [logoClinicaPreview, setLogoClinicaPreview] = useState<string | null>(profile?.logo_clinica_url || null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "O código foi copiado para a área de transferência."
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const uploadImage = async (file: File, type: 'perfil' | 'logo'): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.user_id}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('professional-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('professional-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload da imagem",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleImageChange = (file: File | null, type: 'perfil' | 'logo') => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'perfil') {
        setFotoPerfil(file);
        setFotoPerfilPreview(reader.result as string);
      } else {
        setLogoClinica(file);
        setLogoClinicaPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let updatedData = { ...formData };

      // Upload das imagens se houver
      if (fotoPerfil) {
        const url = await uploadImage(fotoPerfil, 'perfil');
        if (url) updatedData = { ...updatedData, foto_perfil_url: url } as any;
      }

      if (logoClinica) {
        const url = await uploadImage(logoClinica, 'logo');
        if (url) updatedData = { ...updatedData, logo_clinica_url: url } as any;
      }

      const { error } = await updateProfile(updatedData);
      if (error) throw error;
      
      // Limpar arquivos selecionados após sucesso
      setFotoPerfil(null);
      setLogoClinica(null);
    } catch (error: any) {
      // Toast já é mostrado no updateProfile
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "A nova senha e a confirmação não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!",
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar a senha.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const { error } = await deleteAccount();
      if (!error) {
        // A navegação será feita automaticamente pelo AuthContext
      }
    } catch (error: any) {
      // Toast já é mostrado no deleteAccount
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <SidebarTrigger />
          <div className="ml-4">
            <h2 className="font-semibold text-foreground">Configurações</h2>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-2xl">
        {/* Informações do Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais e profissionais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Código do Usuário */}
            <div className="space-y-2 mb-6">
              <Label>Seu Código de Identificação</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={profile?.codigo || 'Gerando código...'}
                    readOnly
                    className="font-mono text-lg"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => profile?.codigo && copyToClipboard(profile.codigo)}
                  disabled={!profile?.codigo}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {profile?.tipo === 'paciente' 
                  ? 'Compartilhe este código com seu profissional para ser vinculado ao tratamento.'
                  : 'Use este código em relatórios e identificações profissionais.'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O e-mail não pode ser alterado
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange('telefone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de usuário</Label>
                  <Input
                    id="tipo"
                    value={profile?.tipo === 'profissional' ? 'Profissional' : 'Paciente'}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {profile?.tipo === 'profissional' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crp_crm">CRP/CRM</Label>
                    <Input
                      id="crp_crm"
                      placeholder="ex: CRP 12345"
                      value={formData.crp_crm}
                      onChange={(e) => handleInputChange('crp_crm', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="especialidade">Especialidade</Label>
                    <Input
                      id="especialidade"
                      placeholder="ex: Psicologia Clínica"
                      value={formData.especialidade}
                      onChange={(e) => handleInputChange('especialidade', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {profile?.tipo === 'profissional' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clinica">Clínica / Consultório</Label>
                    <Input
                      id="clinica"
                      placeholder="ex: Clínica de Psicologia ABC"
                      value={formData.clinica}
                      onChange={(e) => handleInputChange('clinica', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      placeholder="ex: Rua ABC, 123 - Bairro, Cidade - UF"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange('endereco', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Biografia / Sobre</Label>
                    <Textarea
                      id="bio"
                      placeholder="Conte um pouco sobre sua formação, experiência e abordagem profissional..."
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta informação será exibida no seu perfil público para os pacientes
                    </p>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium">Imagens do Perfil (Opcional)</h4>
                    
                    <div className="space-y-2">
                      <Label>Foto de Perfil</Label>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={fotoPerfilPreview || undefined} />
                          <AvatarFallback>
                            <User className="h-10 w-10" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e.target.files?.[0] || null, 'perfil')}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Recomendado: imagem quadrada, mínimo 200x200px
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Logo da Clínica</Label>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 rounded-md">
                          <AvatarImage src={logoClinicaPreview || undefined} className="object-contain" />
                          <AvatarFallback className="rounded-md">
                            <Building2 className="h-10 w-10" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e.target.files?.[0] || null, 'logo')}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Recomendado: formato retangular ou quadrado
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              </form>
            </CardContent>
          </Card>

        {/* Alterar Senha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>
              Atualize sua senha de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Digite sua nova senha"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme sua nova senha"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Configurações de Notificação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure como você deseja receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Lembrete de registro diário</h4>
                  <p className="text-sm text-muted-foreground">
                    Receber lembrete para fazer registro diário
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Em breve
                </Button>
              </div>

              {profile?.tipo === 'profissional' && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Alertas de pacientes</h4>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações sobre alertas dos pacientes
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Em breve
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assinatura (apenas para profissionais) */}
        {profile?.tipo === 'profissional' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Plano de Assinatura
              </CardTitle>
              <CardDescription>
                Gerencie seu plano e faturamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Plano Atual</h4>
                    <p className="text-sm text-muted-foreground">Plano Gratuito</p>
                  </div>
                  <Button variant="outline">
                    Upgrade
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  No plano gratuito você pode acompanhar até 5 pacientes. 
                  Faça upgrade para recursos ilimitados.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integração de Calendário */}
        {profile?.tipo === 'profissional' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Integração de Calendário</h3>
              <p className="text-sm text-muted-foreground">
                Conecte suas contas de calendário para sincronizar compromissos automaticamente.
              </p>
            </div>
            <GoogleCalendarConnect />
          </div>
        )}

        {/* Zona de Perigo */}
        <Card className="border-health-danger/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-health-danger">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis para sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-health-danger/20 rounded-lg bg-health-danger/5">
                <h4 className="font-medium text-health-danger mb-2">Excluir conta</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta ação não pode ser desfeita. Todos os seus dados serão perdidos permanentemente.
                </p>
                {!showDeleteConfirm ? (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Excluir Conta
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-health-danger">
                      Tem certeza? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleDeleteAccount}
                        disabled={loading}
                      >
                        {loading ? 'Excluindo...' : 'Sim, excluir definitivamente'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Configuracoes;