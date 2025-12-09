export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      ai_summaries: {
        Row: {
          created_at: string
          encrypted_content: string | null
          generated_by: string | null
          id: string
          patient_id: string
          period_end: string
          period_start: string
          redacted_content: string | null
          sections_json: Json
          status: string
          summary_type: string
          tokens_used: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_content?: string | null
          generated_by?: string | null
          id?: string
          patient_id: string
          period_end: string
          period_start: string
          redacted_content?: string | null
          sections_json?: Json
          status?: string
          summary_type?: string
          tokens_used?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_content?: string | null
          generated_by?: string | null
          id?: string
          patient_id?: string
          period_end?: string
          period_start?: string
          redacted_content?: string | null
          sections_json?: Json
          status?: string
          summary_type?: string
          tokens_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_ledger: {
        Row: {
          cost_cents: number
          created_at: string
          feature: string
          id: string
          metadata: Json | null
          patient_id: string | null
          tokens: number
          user_id: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          feature: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          tokens?: number
          user_id: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          feature?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      alert_delivery: {
        Row: {
          alert_id: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_id: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_delivery_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alert_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_instances: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          patient_id: string
          payload_json: Json | null
          rule_id: string
          status: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          patient_id: string
          payload_json?: Json | null
          rule_id: string
          status?: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          payload_json?: Json | null
          rule_id?: string
          status?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_instances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "alert_instances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_instances_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          created_at: string
          dedup_window_minutes: number | null
          definition_json: Json
          id: string
          is_active: boolean | null
          name: string
          owner_user_id: string
          patient_id: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedup_window_minutes?: number | null
          definition_json: Json
          id?: string
          is_active?: boolean | null
          name: string
          owner_user_id: string
          patient_id?: string | null
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedup_window_minutes?: number | null
          definition_json?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          owner_user_id?: string
          patient_id?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "alert_rules_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshot: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          patient_id: string
          payload_json: Json
          window_end: string
          window_start: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          patient_id: string
          payload_json: Json
          window_end: string
          window_start: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          patient_id?: string
          payload_json?: Json
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          location: string | null
          patient_id: string
          professional_id: string
          start_time: string
          status: string
          sync_to_calendar: boolean
          telemedicine_link: string | null
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          patient_id: string
          professional_id: string
          start_time: string
          status?: string
          sync_to_calendar?: boolean
          telemedicine_link?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
          patient_id?: string
          professional_id?: string
          start_time?: string
          status?: string
          sync_to_calendar?: boolean
          telemedicine_link?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      bot_interaction: {
        Row: {
          created_at: string
          id: string
          matched_content_id: string | null
          message: string
          metadata: Json | null
          patient_id: string
          reply: string
          risk_score: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          matched_content_id?: string | null
          message: string
          metadata?: Json | null
          patient_id: string
          reply: string
          risk_score?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          matched_content_id?: string | null
          message?: string
          metadata?: Json | null
          patient_id?: string
          reply?: string
          risk_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_interaction_matched_content_id_fkey"
            columns: ["matched_content_id"]
            isOneToOne: false
            referencedRelation: "bot_knowledge"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_interaction_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "bot_interaction_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_knowledge: {
        Row: {
          category: string
          content_md: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[] | null
          locale: string
          reviewed_at: string | null
          reviewed_by: string | null
          tags: string[] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          content_md: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          locale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          content_md?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          locale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_knowledge_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token_enc: string
          connected_at: string
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          provider_email: string | null
          refresh_token_enc: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc: string
          connected_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          provider_email?: string | null
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string
          connected_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          provider_email?: string | null
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_event_links: {
        Row: {
          appointment_id: string
          calendar_connection_id: string
          created_at: string
          error_message: string | null
          id: string
          last_synced_at: string
          provider_event_id: string
          provider_version: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          calendar_connection_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string
          provider_event_id: string
          provider_version?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          calendar_connection_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string
          provider_event_id?: string
          provider_version?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_calendar_connection_id_fkey"
            columns: ["calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      care_team: {
        Row: {
          added_at: string
          id: string
          patient_id: string
          professional_id: string
          role: string | null
        }
        Insert: {
          added_at?: string
          id?: string
          patient_id: string
          professional_id: string
          role?: string | null
        }
        Update: {
          added_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          role?: string | null
        }
        Relationships: []
      }
      clinical_alerts: {
        Row: {
          ai_analysis: Json | null
          alert_level: string | null
          alert_type: string | null
          analyzed_at: string | null
          created_at: string
          id: string
          profissional_id: string
          record_id: string
          visualizado: boolean | null
        }
        Insert: {
          ai_analysis?: Json | null
          alert_level?: string | null
          alert_type?: string | null
          analyzed_at?: string | null
          created_at?: string
          id?: string
          profissional_id: string
          record_id: string
          visualizado?: boolean | null
        }
        Update: {
          ai_analysis?: Json | null
          alert_level?: string | null
          alert_type?: string | null
          analyzed_at?: string | null
          created_at?: string
          id?: string
          profissional_id?: string
          record_id?: string
          visualizado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_alerts_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_alerts_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "daily_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_resources: {
        Row: {
          available_hours: string | null
          country_code: string
          created_at: string
          description: string | null
          hotline_name: string
          id: string
          is_active: boolean
          phone_number: string
          region: string | null
          updated_at: string
        }
        Insert: {
          available_hours?: string | null
          country_code: string
          created_at?: string
          description?: string | null
          hotline_name: string
          id?: string
          is_active?: boolean
          phone_number: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          available_hours?: string | null
          country_code?: string
          created_at?: string
          description?: string | null
          hotline_name?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_records: {
        Row: {
          como_se_sentiu: string | null
          created_at: string
          data: string
          energia: number | null
          gatilhos: string | null
          humor: Database["public"]["Enums"]["mood_level"]
          id: string
          observacoes_profissional: string | null
          patient_id: string
          sinal_alerta: boolean | null
          sleep_hours: number | null
          updated_at: string
        }
        Insert: {
          como_se_sentiu?: string | null
          created_at?: string
          data: string
          energia?: number | null
          gatilhos?: string | null
          humor: Database["public"]["Enums"]["mood_level"]
          id?: string
          observacoes_profissional?: string | null
          patient_id: string
          sinal_alerta?: boolean | null
          sleep_hours?: number | null
          updated_at?: string
        }
        Update: {
          como_se_sentiu?: string | null
          created_at?: string
          data?: string
          energia?: number | null
          gatilhos?: string | null
          humor?: Database["public"]["Enums"]["mood_level"]
          id?: string
          observacoes_profissional?: string | null
          patient_id?: string
          sinal_alerta?: boolean | null
          sleep_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "daily_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_name: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_name: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_name?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      internal_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean | null
          patient_id: string
          tags: string[] | null
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          patient_id: string
          tags?: string[] | null
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          patient_id?: string
          tags?: string[] | null
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_internal_comments_author"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "fk_internal_comments_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      link_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          requester_id: string
          requester_type: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          requester_id: string
          requester_type: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          requester_id?: string
          requester_type?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_intakes: {
        Row: {
          created_at: string
          data_horario: string
          id: string
          medication_id: string
          observacoes: string | null
          patient_id: string
          tomado: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_horario: string
          id?: string
          medication_id: string
          observacoes?: string | null
          patient_id: string
          tomado?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_horario?: string
          id?: string
          medication_id?: string
          observacoes?: string | null
          patient_id?: string
          tomado?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_intakes_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_intakes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "medication_intakes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          dosagem: string
          frequencia: number
          horarios: string[]
          id: string
          nome_medicamento: string
          observacoes: string | null
          patient_id: string
          prescrito_por: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          dosagem: string
          frequencia?: number
          horarios?: string[]
          id?: string
          nome_medicamento: string
          observacoes?: string | null
          patient_id: string
          prescrito_por: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dosagem?: string
          frequencia?: number
          horarios?: string[]
          id?: string
          nome_medicamento?: string
          observacoes?: string | null
          patient_id?: string
          prescrito_por?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_prescrito_por_fkey"
            columns: ["prescrito_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          message_id: string
          mime_type: string
          size_bytes: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_participants: {
        Row: {
          id: string
          joined_at: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_status: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          last_message_at: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          has_attachment: boolean
          id: string
          is_deleted: boolean
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          has_attachment?: boolean
          id?: string
          is_deleted?: boolean
          thread_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          has_attachment?: boolean
          id?: string
          is_deleted?: boolean
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_professionals: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          professional_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          professional_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_professionals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_professionals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_questionnaire_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_question: number
          id: string
          next_cycle_date: string | null
          patient_id: string
          questionnaire_id: string
          questions_answered: number
          started_at: string
          status: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_question?: number
          id?: string
          next_cycle_date?: string | null
          patient_id: string
          questionnaire_id: string
          questions_answered?: number
          started_at?: string
          status?: string
          total_questions: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_question?: number
          id?: string
          next_cycle_date?: string | null
          patient_id?: string
          questionnaire_id?: string
          questions_answered?: number
          started_at?: string
          status?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_questionnaire_progress_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_questionnaire_progress_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_questionnaire_progress_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_questionnaire_settings: {
        Row: {
          activated_at: string
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          patient_id: string
          professional_id: string
          questionnaire_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          patient_id: string
          professional_id: string
          questionnaire_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          patient_id?: string
          professional_id?: string
          questionnaire_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_questionnaire_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_questionnaire_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_questionnaire_settings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_questionnaire_settings_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          ativo: boolean | null
          contato_emergencia: string | null
          created_at: string
          data_nascimento: string | null
          endereco: string | null
          genero: string | null
          historico_clinico: string | null
          id: string
          medicamentos_atuais: string | null
          profissional_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          contato_emergencia?: string | null
          created_at?: string
          data_nascimento?: string | null
          endereco?: string | null
          genero?: string | null
          historico_clinico?: string | null
          id?: string
          medicamentos_atuais?: string | null
          profissional_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          contato_emergencia?: string | null
          created_at?: string
          data_nascimento?: string | null
          endereco?: string | null
          genero?: string | null
          historico_clinico?: string | null
          id?: string
          medicamentos_atuais?: string | null
          profissional_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          clinica: string | null
          codigo: string | null
          created_at: string
          crp_crm: string | null
          email: string
          endereco: string | null
          especialidade: string | null
          foto_perfil_url: string | null
          id: string
          is_medico: boolean | null
          logo_clinica_url: string | null
          nome: string
          telefone: string | null
          tipo: Database["public"]["Enums"]["user_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          clinica?: string | null
          codigo?: string | null
          created_at?: string
          crp_crm?: string | null
          email: string
          endereco?: string | null
          especialidade?: string | null
          foto_perfil_url?: string | null
          id?: string
          is_medico?: boolean | null
          logo_clinica_url?: string | null
          nome: string
          telefone?: string | null
          tipo: Database["public"]["Enums"]["user_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          clinica?: string | null
          codigo?: string | null
          created_at?: string
          crp_crm?: string | null
          email?: string
          endereco?: string | null
          especialidade?: string | null
          foto_perfil_url?: string | null
          id?: string
          is_medico?: boolean | null
          logo_clinica_url?: string | null
          nome?: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["user_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questionnaire_questions: {
        Row: {
          created_at: string
          id: string
          options: Json
          question_number: number
          question_text: string
          questionnaire_id: string
          risk_threshold: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          options: Json
          question_number: number
          question_text: string
          questionnaire_id: string
          risk_threshold?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          question_number?: number
          question_text?: string
          questionnaire_id?: string
          risk_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_responses: {
        Row: {
          answered_at: string
          created_at: string
          daily_record_id: string | null
          id: string
          patient_id: string
          question_id: string
          question_number: number
          questionnaire_id: string
          response_text: string | null
          response_value: number
        }
        Insert: {
          answered_at?: string
          created_at?: string
          daily_record_id?: string | null
          id?: string
          patient_id: string
          question_id: string
          question_number: number
          questionnaire_id: string
          response_text?: string | null
          response_value: number
        }
        Update: {
          answered_at?: string
          created_at?: string
          daily_record_id?: string | null
          id?: string
          patient_id?: string
          question_id?: string
          question_number?: number
          questionnaire_id?: string
          response_text?: string | null
          response_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_metrics"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "questionnaire_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          active_by_default: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          active_by_default?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          total_questions: number
          updated_at?: string
        }
        Update: {
          active_by_default?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          pacientes_ativos: number | null
          plano: Database["public"]["Enums"]["subscription_plan"]
          profissional_id: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          valor_mensal: number | null
          valor_por_paciente: number | null
          vencimento: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pacientes_ativos?: number | null
          plano?: Database["public"]["Enums"]["subscription_plan"]
          profissional_id: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          valor_mensal?: number | null
          valor_por_paciente?: number | null
          vencimento?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pacientes_ativos?: number | null
          plano?: Database["public"]["Enums"]["subscription_plan"]
          profissional_id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          valor_mensal?: number | null
          valor_por_paciente?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_consent: {
        Row: {
          consented_at: string
          created_at: string
          device_info: Json | null
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          consented_at?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          consented_at?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      voice_transcription_logs: {
        Row: {
          confidence: number | null
          created_at: string
          duration_sec: number
          error_message: string | null
          file_size_bytes: number
          id: string
          language_detected: string | null
          patient_id: string
          provider: string
          status: string
          transcription_time_ms: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          duration_sec: number
          error_message?: string | null
          file_size_bytes: number
          id?: string
          language_detected?: string | null
          patient_id: string
          provider?: string
          status: string
          transcription_time_ms?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          duration_sec?: number
          error_message?: string | null
          file_size_bytes?: number
          id?: string
          language_detected?: string | null
          patient_id?: string
          provider?: string
          status?: string
          transcription_time_ms?: number | null
        }
        Relationships: []
      }
      voice_usage_daily: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          transcriptions_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          transcriptions_count?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          transcriptions_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      patient_metrics: {
        Row: {
          checkin_missing_3d: boolean | null
          days_without_medication: number | null
          gad7_score: number | null
          mood_latest: number | null
          patient_id: string | null
          phq9_score: number | null
          sleep_hours_avg_7d: number | null
          suicide_risk_score: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_alert_duplicate: {
        Args: {
          p_dedup_minutes: number
          p_patient_id: string
          p_rule_id: string
        }
        Returns: boolean
      }
      cleanup_old_analytics_snapshots: { Args: never; Returns: undefined }
      evaluate_alert_rule: {
        Args: { patient_metrics_data: Json; rule_definition: Json }
        Returns: boolean
      }
      find_patient_by_code: {
        Args: { patient_code: string }
        Returns: {
          codigo: string
          email: string
          id: string
          nome: string
          tipo: string
          user_id: string
        }[]
      }
      generate_codes_for_existing_users: { Args: never; Returns: undefined }
      generate_user_code: { Args: never; Returns: string }
      get_patient_linked_professional_ids: { Args: never; Returns: string[] }
      get_professional_patient_ids: { Args: never; Returns: string[] }
      get_unread_message_count: { Args: never; Returns: number }
      get_user_type: { Args: never; Returns: string }
      process_link_request: {
        Args: { action: string; request_id: string }
        Returns: boolean
      }
      request_patient_summary: {
        Args: {
          p_patient_id: string
          p_period_end: string
          p_period_start: string
          p_summary_type?: string
        }
        Returns: string
      }
      restart_completed_questionnaires: { Args: never; Returns: undefined }
    }
    Enums: {
      mood_level: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
      subscription_plan: "basico" | "premium" | "enterprise"
      user_type: "paciente" | "profissional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      mood_level: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      subscription_plan: ["basico", "premium", "enterprise"],
      user_type: ["paciente", "profissional"],
    },
  },
} as const
