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
      coupon_allocation_rules: {
        Row: {
          coupon_prefix: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          quantity_per_participant: number
          rule_name: string
        }
        Insert: {
          coupon_prefix: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          quantity_per_participant?: number
          rule_name: string
        }
        Update: {
          coupon_prefix?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          quantity_per_participant?: number
          rule_name?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          assigned_at: string | null
          coupon_code: string
          created_at: string
          email: string | null
          note: string | null
          used_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          coupon_code: string
          created_at?: string
          email?: string | null
          note?: string | null
          used_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          coupon_code?: string
          created_at?: string
          email?: string | null
          note?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["email"]
          },
        ]
      }
      lottery_entries: {
        Row: {
          created_at: string
          email: string
          id: string
          raw_payload: string | null
          source: string
          tn_number: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          raw_payload?: string | null
          source?: string
          tn_number: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          raw_payload?: string | null
          source?: string
          tn_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_entries_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["email"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          device_id: string | null
          email: string
          language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          email: string
          language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          email?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      valid_transactions: {
        Row: {
          amount: number | null
          created_at: string
          store_code: string | null
          tn_number: string
          txn_date: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          store_code?: string | null
          tn_number: string
          txn_date?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          store_code?: string | null
          tn_number?: string
          txn_date?: string | null
        }
        Relationships: []
      }
      winners: {
        Row: {
          announced_at: string
          id: string
          is_backup: boolean
          masked_email: string
          prize_name: string
          rank: number
        }
        Insert: {
          announced_at?: string
          id?: string
          is_backup?: boolean
          masked_email: string
          prize_name: string
          rank?: number
        }
        Update: {
          announced_at?: string
          id?: string
          is_backup?: boolean
          masked_email?: string
          prize_name?: string
          rank?: number
        }
        Relationships: []
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
    Enums: {},
  },
} as const
