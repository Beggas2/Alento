-- Add sleep_hours column to daily_records table
ALTER TABLE public.daily_records 
ADD COLUMN sleep_hours integer;

-- Add a comment to document the column
COMMENT ON COLUMN public.daily_records.sleep_hours IS 'Number of hours of sleep';