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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          contest_slug: string | null
          cta_label: string | null
          id: string
          kind: string
          published_at: string
          summary: string
          title: string
        }
        Insert: {
          contest_slug?: string | null
          cta_label?: string | null
          id?: string
          kind: string
          published_at: string
          summary: string
          title: string
        }
        Update: {
          contest_slug?: string | null
          cta_label?: string | null
          id?: string
          kind?: string
          published_at?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      campus_passes: {
        Row: {
          check_in_opens_at: string
          contest_id: string
          id: string
          member_id: string
          pass_code: string
          prn_hash: string
          seat: string
          status: string
          venue: string
        }
        Insert: {
          check_in_opens_at: string
          contest_id: string
          id?: string
          member_id: string
          pass_code: string
          prn_hash: string
          seat: string
          status?: string
          venue: string
        }
        Update: {
          check_in_opens_at?: string
          contest_id?: string
          id?: string
          member_id?: string
          pass_code?: string
          prn_hash?: string
          seat?: string
          status?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_passes_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "offline_contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_problems: {
        Row: {
          contest_id: string
          editorial_summary: string | null
          first_ac_seconds: number | null
          id: string
          points: number
          problem_index: string
          solved_count: number
          title: string
          topic: string
        }
        Insert: {
          contest_id: string
          editorial_summary?: string | null
          first_ac_seconds?: number | null
          id?: string
          points: number
          problem_index: string
          solved_count?: number
          title: string
          topic: string
        }
        Update: {
          contest_id?: string
          editorial_summary?: string | null
          first_ac_seconds?: number | null
          id?: string
          points?: number
          problem_index?: string
          solved_count?: number
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_problems_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "offline_contests"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          attendance_count: number
          attendance_total: number
          batch: string
          created_at: string
          department: string
          email: string
          full_name: string
          handle: string
          id: string
          is_core_member: boolean
          peak_rating: number
          prn: string
          rating: number
        }
        Insert: {
          attendance_count?: number
          attendance_total?: number
          batch: string
          created_at?: string
          department: string
          email: string
          full_name: string
          handle: string
          id: string
          is_core_member?: boolean
          peak_rating?: number
          prn: string
          rating?: number
        }
        Update: {
          attendance_count?: number
          attendance_total?: number
          batch?: string
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          handle?: string
          id?: string
          is_core_member?: boolean
          peak_rating?: number
          prn?: string
          rating?: number
        }
        Relationships: []
      }
      offline_contests: {
        Row: {
          check_in_opens_at: string
          chief_proctors: string[]
          created_at: string
          division: string
          ends_at: string
          environment: string
          id: string
          prize_pool: string | null
          problem_count: number
          registered_count: number
          rules: string[]
          season: string
          seat_capacity: number
          slug: string
          sponsor: string | null
          starts_at: string
          status: string
          summary: string
          title: string
          venue: string
        }
        Insert: {
          check_in_opens_at: string
          chief_proctors?: string[]
          created_at?: string
          division: string
          ends_at: string
          environment: string
          id?: string
          prize_pool?: string | null
          problem_count: number
          registered_count?: number
          rules?: string[]
          season: string
          seat_capacity: number
          slug: string
          sponsor?: string | null
          starts_at: string
          status: string
          summary: string
          title: string
          venue: string
        }
        Update: {
          check_in_opens_at?: string
          chief_proctors?: string[]
          created_at?: string
          division?: string
          ends_at?: string
          environment?: string
          id?: string
          prize_pool?: string | null
          problem_count?: number
          registered_count?: number
          rules?: string[]
          season?: string
          seat_capacity?: number
          slug?: string
          sponsor?: string | null
          starts_at?: string
          status?: string
          summary?: string
          title?: string
          venue?: string
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          contest_id: string | null
          contest_title: string
          contested_at: string
          id: string
          member_id: string
          new_rating: number
          old_rating: number
          rank: number
        }
        Insert: {
          contest_id?: string | null
          contest_title: string
          contested_at: string
          id?: string
          member_id: string
          new_rating: number
          old_rating: number
          rank: number
        }
        Update: {
          contest_id?: string | null
          contest_title?: string
          contested_at?: string
          id?: string
          member_id?: string
          new_rating?: number
          old_rating?: number
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "offline_contests"
            referencedColumns: ["id"]
          },
        ]
      }
      scoreboard_entries: {
        Row: {
          batch: string
          contest_id: string
          department: string
          division: string
          full_name: string
          handle: string
          id: string
          member_id: string | null
          penalty_seconds: number
          rank: number
          rating_delta: number | null
          score: number
          solved: number
          telemetry: Json
        }
        Insert: {
          batch: string
          contest_id: string
          department: string
          division: string
          full_name: string
          handle: string
          id?: string
          member_id?: string | null
          penalty_seconds: number
          rank: number
          rating_delta?: number | null
          score: number
          solved: number
          telemetry?: Json
        }
        Update: {
          batch?: string
          contest_id?: string
          department?: string
          division?: string
          full_name?: string
          handle?: string
          id?: string
          member_id?: string | null
          penalty_seconds?: number
          rank?: number
          rating_delta?: number | null
          score?: number
          solved?: number
          telemetry?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scoreboard_entries_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "offline_contests"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_proofs: {
        Row: {
          attendance_stamp: string
          certificate_id: string
          contest_id: string
          contest_title: string
          id: string
          issued_at: string
          member_handle: string
          member_id: string | null
          prn_hash: string
          proctor_stamp: string
          rank: number
          score: number
          session_uuid: string
          sha256_digest: string
          status: string
        }
        Insert: {
          attendance_stamp: string
          certificate_id: string
          contest_id: string
          contest_title: string
          id?: string
          issued_at: string
          member_handle: string
          member_id?: string | null
          prn_hash: string
          proctor_stamp: string
          rank: number
          score: number
          session_uuid: string
          sha256_digest: string
          status?: string
        }
        Update: {
          attendance_stamp?: string
          certificate_id?: string
          contest_id?: string
          contest_title?: string
          id?: string
          issued_at?: string
          member_handle?: string
          member_id?: string | null
          prn_hash?: string
          proctor_stamp?: string
          rank?: number
          score?: number
          session_uuid?: string
          sha256_digest?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_proofs_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "offline_contests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
