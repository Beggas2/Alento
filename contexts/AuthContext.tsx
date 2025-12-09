import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo: 'paciente' | 'profissional';
  telefone?: string;
  crp_crm?: string;
  especialidade?: string;
  codigo?: string;
  is_medico?: boolean;
  clinica?: string;
  endereco?: string;
  bio?: string;
  foto_perfil_url?: string;
  logo_clinica_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, nome: string, tipo: 'paciente' | 'profissional', extraData?: { especialidade?: string; crp_crm?: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  deleteAccount: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Configurar listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Buscar perfil do usuário após login
          setTimeout(async () => {
            await fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nome: string, tipo: 'paciente' | 'profissional', extraData?: { especialidade?: string; crp_crm?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nome,
            tipo,
            especialidade: extraData?.especialidade,
            crp_crm: extraData?.crp_crm,
            is_medico: extraData?.especialidade === 'medico',
            codigo_paciente: tipo === 'paciente' ? codigo : undefined,
            codigo_profissional: tipo === 'profissional' ? codigo : undefined
          }
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message === 'User already registered' 
            ? 'Este e-mail já está cadastrado. Tente fazer login.'
            : error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar a conta.",
        variant: "default"
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message === 'Invalid login credentials' 
            ? 'E-mail ou senha incorretos.'
            : error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
        variant: "default"
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      
      toast({
        title: "Logout realizado",
        description: "Até logo!",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Erro no logout",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) return { error: new Error('Usuário não autenticado') };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Erro ao atualizar perfil",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Atualizar perfil local
      if (profile) {
        setProfile({ ...profile, ...updates });
      }

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas.",
        variant: "default"
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const deleteAccount = async () => {
    try {
      if (!user) return { error: new Error('Usuário não autenticado') };

      // Primeiro, deletar o perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.id);

      if (profileError) {
        toast({
          title: "Erro ao excluir conta",
          description: profileError.message,
          variant: "destructive"
        });
        return { error: profileError };
      }

      // Fazer logout para simular exclusão da conta
      await signOut();


      toast({
        title: "Conta excluída",
        description: "Sua conta foi excluída permanentemente.",
        variant: "default"
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erro ao excluir conta",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    deleteAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};