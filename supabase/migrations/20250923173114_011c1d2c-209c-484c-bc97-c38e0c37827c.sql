-- Fix function search path for security
DROP FUNCTION IF EXISTS public.cleanup_old_analytics_snapshots();

CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Remove snapshots older than 30 days
    DELETE FROM public.analytics_snapshot
    WHERE computed_at < now() - interval '30 days';
END;
$function$;