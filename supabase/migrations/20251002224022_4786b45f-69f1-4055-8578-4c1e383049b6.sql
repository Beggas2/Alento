-- Add columns for professional images
ALTER TABLE public.profiles 
ADD COLUMN foto_perfil_url text,
ADD COLUMN logo_clinica_url text;

-- Create storage bucket for professional images
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-images', 'professional-images', true);

-- Create policies for professional images bucket
CREATE POLICY "Professionals can upload their own images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'professional-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tipo = 'profissional'
  )
);

CREATE POLICY "Professionals can update their own images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'professional-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Professionals can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'professional-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Professional images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'professional-images');