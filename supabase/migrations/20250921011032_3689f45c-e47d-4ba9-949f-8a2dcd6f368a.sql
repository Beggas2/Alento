-- Add proper foreign key constraints for internal comments
ALTER TABLE public.internal_comments 
ADD CONSTRAINT fk_internal_comments_patient 
FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.internal_comments 
ADD CONSTRAINT fk_internal_comments_author 
FOREIGN KEY (author_id) REFERENCES public.profiles(id);