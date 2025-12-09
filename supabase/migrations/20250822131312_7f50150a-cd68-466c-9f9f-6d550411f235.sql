-- Adicionar foreign keys que estão faltando (somente se não existirem)
DO $$ 
BEGIN
    -- link_requests foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'link_requests_requester_id_fkey') THEN
        ALTER TABLE link_requests 
        ADD CONSTRAINT link_requests_requester_id_fkey 
        FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'link_requests_target_id_fkey') THEN
        ALTER TABLE link_requests 
        ADD CONSTRAINT link_requests_target_id_fkey 
        FOREIGN KEY (target_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- clinical_alerts foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'clinical_alerts_profissional_id_fkey') THEN
        ALTER TABLE clinical_alerts 
        ADD CONSTRAINT clinical_alerts_profissional_id_fkey 
        FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- patients foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patients_profissional_id_fkey') THEN
        ALTER TABLE patients 
        ADD CONSTRAINT patients_profissional_id_fkey 
        FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    -- medications foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medications_patient_id_fkey') THEN
        ALTER TABLE medications 
        ADD CONSTRAINT medications_patient_id_fkey 
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medications_prescrito_por_fkey') THEN
        ALTER TABLE medications 
        ADD CONSTRAINT medications_prescrito_por_fkey 
        FOREIGN KEY (prescrito_por) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- medication_intakes foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medication_intakes_medication_id_fkey') THEN
        ALTER TABLE medication_intakes 
        ADD CONSTRAINT medication_intakes_medication_id_fkey 
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medication_intakes_patient_id_fkey') THEN
        ALTER TABLE medication_intakes 
        ADD CONSTRAINT medication_intakes_patient_id_fkey 
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
    END IF;

    -- daily_records foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'daily_records_patient_id_fkey') THEN
        ALTER TABLE daily_records 
        ADD CONSTRAINT daily_records_patient_id_fkey 
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
    END IF;

    -- subscriptions foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subscriptions_profissional_id_fkey') THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_profissional_id_fkey 
        FOREIGN KEY (profissional_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;