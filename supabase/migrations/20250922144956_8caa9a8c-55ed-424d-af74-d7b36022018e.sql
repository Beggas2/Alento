-- Create message thread table
CREATE TABLE public.message_threads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Create message participants table
CREATE TABLE public.message_participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'professional')),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(thread_id, user_id)
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    body TEXT NOT NULL,
    has_attachment BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create message attachments table
CREATE TABLE public.message_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_mime_types CHECK (
        mime_type IN (
            'application/pdf',
            'image/jpeg', 
            'image/jpg',
            'image/png',
            'image/webp'
        )
    ),
    CONSTRAINT max_file_size CHECK (size_bytes <= 10485760) -- 10MB limit
);

-- Create message read status table
CREATE TABLE public.message_read_status (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_status ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_message_threads_patient_id ON public.message_threads(patient_id);
CREATE INDEX idx_message_threads_updated_at ON public.message_threads(updated_at DESC);
CREATE INDEX idx_message_participants_thread_id ON public.message_participants(thread_id);
CREATE INDEX idx_message_participants_user_id ON public.message_participants(user_id);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_message_attachments_message_id ON public.message_attachments(message_id);
CREATE INDEX idx_message_read_status_user_id ON public.message_read_status(user_id);

-- RLS Policies for message_threads
CREATE POLICY "Patients can view their own threads" 
ON public.message_threads 
FOR SELECT 
USING (
    patient_id IN (
        SELECT id FROM patients WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Professionals can view threads for their patients" 
ON public.message_threads 
FOR SELECT 
USING (
    patient_id IN (
        SELECT pp.patient_id 
        FROM patient_professionals pp
        JOIN profiles prof ON pp.professional_id = prof.id
        WHERE prof.user_id = auth.uid() 
        AND prof.tipo = 'profissional'
        AND pp.status = 'active'
    )
);

CREATE POLICY "Patients can create threads for themselves"
ON public.message_threads
FOR INSERT
WITH CHECK (
    patient_id IN (
        SELECT id FROM patients WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Update thread timestamp on message"
ON public.message_threads
FOR UPDATE
USING (
    patient_id IN (
        SELECT id FROM patients WHERE user_id = auth.uid()
    ) OR 
    patient_id IN (
        SELECT pp.patient_id 
        FROM patient_professionals pp
        JOIN profiles prof ON pp.professional_id = prof.id
        WHERE prof.user_id = auth.uid() 
        AND prof.tipo = 'profissional'
        AND pp.status = 'active'
    )
);

-- RLS Policies for message_participants
CREATE POLICY "Users can view their own participations"
ON public.message_participants
FOR SELECT
USING (
    user_id = auth.uid() OR
    thread_id IN (
        SELECT id FROM public.message_threads 
        WHERE patient_id IN (
            SELECT id FROM patients WHERE user_id = auth.uid()
        ) OR patient_id IN (
            SELECT pp.patient_id 
            FROM patient_professionals pp
            JOIN profiles prof ON pp.professional_id = prof.id
            WHERE prof.user_id = auth.uid() 
            AND prof.tipo = 'profissional'
            AND pp.status = 'active'
        )
    )
);

CREATE POLICY "System can manage participants"
ON public.message_participants
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their threads"
ON public.messages
FOR SELECT
USING (
    thread_id IN (
        SELECT mp.thread_id 
        FROM message_participants mp
        WHERE mp.user_id = auth.uid()
    ) OR
    thread_id IN (
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
);

CREATE POLICY "Users can create messages in their threads"
ON public.messages
FOR INSERT
WITH CHECK (
    author_id = auth.uid() AND
    (thread_id IN (
        SELECT mp.thread_id 
        FROM message_participants mp
        WHERE mp.user_id = auth.uid()
    ) OR
    thread_id IN (
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
    ))
);

-- RLS Policies for message_attachments
CREATE POLICY "Users can view attachments in their messages"
ON public.message_attachments
FOR SELECT
USING (
    message_id IN (
        SELECT id FROM messages
        WHERE thread_id IN (
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
    )
);

CREATE POLICY "Users can upload attachments to their messages"
ON public.message_attachments
FOR INSERT
WITH CHECK (
    message_id IN (
        SELECT id FROM messages 
        WHERE author_id = auth.uid()
    )
);

-- RLS Policies for message_read_status
CREATE POLICY "Users can manage their own read status"
ON public.message_read_status
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-attachments', 'message-attachments', false);

-- Create storage policies for message attachments
CREATE POLICY "Users can view attachments in their threads"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'message-attachments' AND
    (storage.foldername(name))[1] IN (
        SELECT mt.id::text
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
);

CREATE POLICY "Users can upload attachments to their threads"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'message-attachments' AND
    (storage.foldername(name))[1] IN (
        SELECT mt.id::text
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
);

-- Function to update thread timestamp
CREATE OR REPLACE FUNCTION public.update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.message_threads 
    SET updated_at = now(), last_message_at = now()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update thread timestamp on new message
CREATE TRIGGER update_thread_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_thread_timestamp();

-- Function to get unread message count for user
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;