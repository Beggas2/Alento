import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlag {
  flag_name: string;
  is_enabled: boolean;
}

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_name, is_enabled');

        if (error) throw error;

        const flagsMap = data.reduce((acc, flag) => {
          acc[flag.flag_name] = flag.is_enabled;
          return acc;
        }, {} as Record<string, boolean>);

        setFlags(flagsMap);
      } catch (error) {
        console.error('Error fetching feature flags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  const isEnabled = (flagName: string) => flags[flagName] || false;

  return { flags, isEnabled, loading };
};