import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Heart, 
  LayoutDashboard, 
  Calendar, 
  Users, 
  FileText, 
  BarChart3, 
  CreditCard, 
  Settings, 
  LogOut,
  Bell,
  Pill,
  MessageSquare,
  TrendingUp,
  Bot
} from 'lucide-react';

export function AppSidebar() {
  const { state } = useSidebar();
  const { profile, signOut } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50";

  // Menu items diferentes para paciente e profissional
  const patientItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Meus Registros", url: "/registros", icon: FileText },
    { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
    { title: "Nala", url: "/chatbot", icon: Bot },
    { title: "Calendário", url: "/calendario", icon: Calendar },
    { title: "Medicamentos", url: "/medicamentos", icon: Pill },
    { title: "Estatísticas", url: "/estatisticas", icon: BarChart3 },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ];

  const professionalItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Meus Pacientes", url: "/pacientes", icon: Users },
    { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
    { title: "Nala", url: "/chatbot", icon: Bot },
    { title: "Calendário", url: "/calendario", icon: Calendar },
    { title: "Medicamentos", url: "/medicamentos", icon: Pill },
    { title: "Alertas", url: "/alertas", icon: Bell },
    { title: "Estatísticas", url: "/estatisticas", icon: BarChart3 },
    { title: "Análise Comparativa", url: "/analise-comparativa", icon: TrendingUp },
    { title: "Assinatura", url: "/assinatura", icon: CreditCard },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ];

  const menuItems = profile?.tipo === 'profissional' ? professionalItems : patientItems;

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="offcanvas">
      {/* Header */}
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-3 px-3 py-4">
          <img src={logo} alt="Alento" className="h-10 w-10 object-contain" />
          {state !== "collapsed" && (
            <div>
              <h2 className="font-semibold text-foreground">Alento</h2>
              <p className="text-xs text-muted-foreground">
                {profile?.tipo === 'profissional' ? 'Profissional' : 'Paciente'}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.title === 'Mensagens' && unreadCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer com perfil do usuário */}
      <SidebarFooter className="border-t border-border">
        <div className="px-3 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {profile?.nome?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {state !== "collapsed" && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.nome}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile?.email}
                  </p>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className={state === "collapsed" ? "w-8 h-8 p-0" : "w-full justify-start"}
            >
              <LogOut className="h-4 w-4" />
              {state !== "collapsed" && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}