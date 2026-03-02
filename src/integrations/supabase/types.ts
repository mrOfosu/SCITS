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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      complaint_activity: {
        Row: {
          action_type: string
          complaint_id: string
          created_at: string
          id: string
          new_status: string
          new_value: Json | null
          old_status: string
          old_value: Json | null
          performed_by: string
          performed_role: string
        }
        Insert: {
          action_type?: string
          complaint_id: string
          created_at?: string
          id?: string
          new_status: string
          new_value?: Json | null
          old_status: string
          old_value?: Json | null
          performed_by: string
          performed_role?: string
        }
        Update: {
          action_type?: string
          complaint_id?: string
          created_at?: string
          id?: string
          new_status?: string
          new_value?: Json | null
          old_status?: string
          old_value?: Json | null
          performed_by?: string
          performed_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_activity_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_responses: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          message: string
          responder_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          message: string
          responder_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          message?: string
          responder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_responses_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          attachment_url: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["complaint_priority"]
          reference_id: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          sub_category: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          sub_category?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          sub_category?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          complaint_id: string
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          id: string
          notification_type: string
          recipient_email: string
          response_id: string | null
          status: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          id?: string
          notification_type?: string
          recipient_email: string
          response_id?: string | null
          status?: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string
          response_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "complaint_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          complaint_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          user_id: string
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          user_id: string
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          display_name: string
          email: string | null
          full_name: string | null
          id: string
          level: string | null
          phone_number: string | null
          profile_completed: boolean
          student_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name: string
          email?: string | null
          full_name?: string | null
          id: string
          level?: string | null
          phone_number?: string | null
          profile_completed?: boolean
          student_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string
          email?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          phone_number?: string | null
          profile_completed?: boolean
          student_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      complaint_category:
        | "academic"
        | "infrastructure"
        | "administrative"
        | "other"
      complaint_priority: "low" | "medium" | "high"
      complaint_status: "pending" | "in_review" | "resolved" | "closed"
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
      app_role: ["admin"],
      complaint_category: [
        "academic",
        "infrastructure",
        "administrative",
        "other",
      ],
      complaint_priority: ["low", "medium", "high"],
      complaint_status: ["pending", "in_review", "resolved", "closed"],
    },
  },
} as const
