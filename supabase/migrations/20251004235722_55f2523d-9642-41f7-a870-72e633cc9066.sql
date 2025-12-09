-- Drop existing policies for message_threads
DROP POLICY IF EXISTS "Users can create threads in their threads" ON message_threads;
DROP POLICY IF EXISTS "Users can view their threads" ON message_threads;
DROP POLICY IF EXISTS "System can manage threads" ON message_threads;

-- Professionals can create threads for their linked patients
CREATE POLICY "Professionals can create threads for their patients"
ON message_threads
FOR INSERT
WITH CHECK (
  patient_id IN (
    SELECT pp.patient_id 
    FROM patient_professionals pp
    JOIN profiles prof ON pp.professional_id = prof.id
    WHERE prof.user_id = auth.uid() 
    AND prof.tipo = 'profissional'
    AND pp.status = 'active'
  )
);

-- Patients can create threads for themselves
CREATE POLICY "Patients can create their own threads"
ON message_threads
FOR INSERT
WITH CHECK (
  patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  )
);

-- Users can view threads they're part of
CREATE POLICY "Users can view their message threads"
ON message_threads
FOR SELECT
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

-- Users can update threads they're part of
CREATE POLICY "Users can update their message threads"
ON message_threads
FOR UPDATE
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