-- Create analytics_snapshot table for caching correlation analysis
CREATE TABLE public.analytics_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  payload_json JSONB NOT NULL,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.analytics_snapshot ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics_snapshot
CREATE POLICY "Professionals can view analytics for their patients" 
ON public.analytics_snapshot 
FOR SELECT 
USING (patient_id IN (
  SELECT pp.patient_id
  FROM patient_professionals pp
  JOIN profiles prof ON pp.professional_id = prof.id
  WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
    AND pp.status = 'active'
));

CREATE POLICY "System can insert analytics snapshots" 
ON public.analytics_snapshot 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_analytics_snapshot_patient_window ON public.analytics_snapshot (patient_id, window_start, window_end);

-- Add function to clean old analytics snapshots
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Remove snapshots older than 30 days
    DELETE FROM public.analytics_snapshot
    WHERE computed_at < now() - interval '30 days';
END;
$function$;