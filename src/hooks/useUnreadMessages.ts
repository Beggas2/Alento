import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { profile } = useAuth();

  const fetchUnreadCount = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase.rpc('get_unread_message_count');
      
      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }
      
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `author_id=neq.${profile?.user_id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Poll for updates every 30 seconds as fallback
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile]);

  return { unreadCount, refreshUnreadCount: fetchUnreadCount };
};