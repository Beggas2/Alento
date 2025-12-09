-- Add DELETE policy for message_threads
CREATE POLICY "Users can delete their message threads"
ON message_threads
FOR DELETE
USING (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
  OR
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
    AND pp.status = 'active'
  )
);