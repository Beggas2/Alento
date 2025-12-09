-- Drop trigger first, then function, then recreate both
DROP TRIGGER IF EXISTS update_thread_on_message ON public.messages;
DROP FUNCTION IF EXISTS public.update_thread_timestamp();
DROP FUNCTION IF EXISTS public.get_unread_message_count();

-- Recreate function with proper search path
CREATE OR REPLACE FUNCTION public.update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.message_threads 
    SET updated_at = now(), last_message_at = now()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
CREATE TRIGGER update_thread_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_thread_timestamp();

-- Recreate function with proper search path
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.thread_id IN (
            SELECT mt.id 
            FROM message_threads mt
            WHERE mt.patient_id IN (
                SELECT id FROM patients WHERE user_id = auth.uid()
            ) OR mt.patient_id IN (
                SELECT pp.patient_id 
                FROM patient_professionals pp
                JOIN profiles prof ON pp.professional_id = prof.id
                WHERE prof.user_id = auth.uid() 
                AND prof.tipo = 'profissional'
                AND pp.status = 'active'
            )
        )
        AND m.author_id != auth.uid()
        AND NOT EXISTS (
            SELECT 1 FROM message_read_status mrs
            WHERE mrs.message_id = m.id AND mrs.user_id = auth.uid()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;