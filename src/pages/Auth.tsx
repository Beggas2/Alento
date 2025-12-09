import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Estados para cadastro
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupNome, setSignupNome] = useState('');
  const [signupTipo, setSignupTipo] = useState<'paciente' | 'profissional'>('paciente');
  const [signupEspecialidade, setSignupEspecialidade] = useState('');
  const [signupCrpCrm, setSignupCrpCrm] = useState('');

  // Redirecionar se já estiver logado
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8DFD3' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#3A6F8F' }} />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signIn(loginEmail, loginPassword);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signUp(signupEmail, signupPassword, signupNome, signupTipo, {
        especialidade: signupEspecialidade,
        crp_crm: signupCrpCrm
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#E8DFD3' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-1">
            <img src={logo} alt="Alento" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="text-4xl font-semibold mb-1" style={{ color: '#2C596A' }}>Alento</h1>
          <p className="text-base" style={{ color: '#6A7075' }}>
            Sistema de Acompanhamento Psicológico com IA
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 p-1 mb-4" style={{ backgroundColor: '#F5EFE6', border: 'none' }}>
            <TabsTrigger 
              value="login" 
              className="h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2"
              style={{ 
                borderRadius: '8px 8px 0 0',
                borderBottom: '2px solid transparent',
              }}
              data-active-border="#3A6F8F"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className="h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2"
              style={{ 
                borderRadius: '8px 8px 0 0',
                borderBottom: '2px solid transparent',
              }}
              data-active-border="#3A6F8F"
            >
              Cadastrar
            </TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login" className="mt-0">
            <Card style={{ 
              backgroundColor: '#F5EFE6', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '16px',
              border: 'none'
            }}>
              <CardContent className="p-8">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label 
                      htmlFor="login-email" 
                      className="text-[15px] font-medium"
                      style={{ color: '#4D5257' }}
                    >
                      E-mail
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                      style={{ 
                        borderColor: '#D6D0C8',
                        color: '#6A7075',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label 
                      htmlFor="login-password" 
                      className="text-[15px] font-medium"
                      style={{ color: '#4D5257' }}
                    >
                      Senha
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                      style={{ 
                        borderColor: '#D6D0C8',
                        color: '#6A7075',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-[52px] rounded-[14px] text-white font-semibold text-base transition-colors duration-200"
                    style={{
                      backgroundColor: isLoading ? '#2F5B75' : '#3A6F8F',
                    }}
                    onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#2F5B75')}
                    onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#3A6F8F')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cadastro */}
          <TabsContent value="signup" className="mt-0">
            <Card style={{ 
              backgroundColor: '#F5EFE6', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '16px',
              border: 'none'
            }}>
              <CardContent className="p-8">
                <form onSubmit={handleSignup} className="space-y-6">
                  <div className="space-y-2">
                    <Label 
                      htmlFor="signup-nome" 
                      className="text-[15px] font-medium"
                      style={{ color: '#4D5257' }}
                    >
                      Nome completo
                    </Label>
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={signupNome}
                      onChange={(e) => setSignupNome(e.target.value)}
                      required
                      className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                      style={{ 
                        borderColor: '#D6D0C8',
                        color: '#6A7075',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label 
                      htmlFor="signup-email" 
                      className="text-[15px] font-medium"
                      style={{ color: '#4D5257' }}
                    >
                      E-mail
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                      style={{ 
                        borderColor: '#D6D0C8',
                        color: '#6A7075',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label 
                      htmlFor="signup-password" 
                      className="text-[15px] font-medium"
                      style={{ color: '#4D5257' }}
                    >
                      Senha
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Crie uma senha segura"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                      style={{ 
                        borderColor: '#D6D0C8',
                        color: '#6A7075',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium" style={{ color: '#4D5257' }}>
                      Tipo de usuário
                    </Label>
                    <RadioGroup 
                      value={signupTipo} 
                      onValueChange={(value) => setSignupTipo(value as 'paciente' | 'profissional')}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="paciente" id="paciente" />
                        <Label htmlFor="paciente" className="font-normal text-sm" style={{ color: '#6A7075' }}>
                          Paciente - Registrar meu humor e bem-estar
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="profissional" id="profissional" />
                        <Label htmlFor="profissional" className="font-normal text-sm" style={{ color: '#6A7075' }}>
                          Profissional - Acompanhar pacientes
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Campos específicos para profissionais */}
                  {signupTipo === 'profissional' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[15px] font-medium" style={{ color: '#4D5257' }}>
                          Especialidade
                        </Label>
                        <RadioGroup 
                          value={signupEspecialidade} 
                          onValueChange={setSignupEspecialidade}
                          className="space-y-3"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medico" id="medico" />
                            <Label htmlFor="medico" className="font-normal text-sm" style={{ color: '#6A7075' }}>
                              Médico - Pode prescrever medicamentos
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="psicologo" id="psicologo" />
                            <Label htmlFor="psicologo" className="font-normal text-sm" style={{ color: '#6A7075' }}>
                              Psicólogo - Acompanhamento psicológico
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label 
                          htmlFor="signup-crpcrm"
                          className="text-[15px] font-medium"
                          style={{ color: '#4D5257' }}
                        >
                          {signupEspecialidade === 'medico' ? 'CRM' : 'CRP'}
                        </Label>
                        <Input
                          id="signup-crpcrm"
                          type="text"
                          placeholder={signupEspecialidade === 'medico' ? 'CRM 12345' : 'CRP 06/12345'}
                          value={signupCrpCrm}
                          onChange={(e) => setSignupCrpCrm(e.target.value)}
                          required={signupTipo === 'profissional'}
                          className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3A6F8F]"
                          style={{ 
                            borderColor: '#D6D0C8',
                            color: '#6A7075',
                            backgroundColor: 'white'
                          }}
                        />
                      </div>
                    </>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-[52px] rounded-[14px] text-white font-semibold text-base transition-colors duration-200"
                    style={{
                      backgroundColor: isLoading ? '#2F5B75' : '#3A6F8F',
                    }}
                    onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#2F5B75')}
                    onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#3A6F8F')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-6 text-sm" style={{ color: '#6A7075' }}>
          <p>
            Ao se cadastrar, você concorda com nossos{' '}
            <a href="#" className="hover:underline" style={{ color: '#3A6F8F' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="#" className="hover:underline" style={{ color: '#3A6F8F' }}>Política de Privacidade</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
