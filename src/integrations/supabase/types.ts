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
      complaint_bookmarks: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_bookmarks_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      complaint_escalations: {
        Row: {
          complaint_id: string
          created_at: string
          escalated_by: string | null
          escalation_reason: string
          id: string
          new_handler_id: string | null
          new_handler_role: string
          previous_handler_id: string | null
          previous_handler_role: string | null
        }
        Insert: {
          complaint_id: string
          created_at?: string
          escalated_by?: string | null
          escalation_reason: string
          id?: string
          new_handler_id?: string | null
          new_handler_role: string
          previous_handler_id?: string | null
          previous_handler_role?: string | null
        }
        Update: {
          complaint_id?: string
          created_at?: string
          escalated_by?: string | null
          escalation_reason?: string
          id?: string
          new_handler_id?: string | null
          new_handler_role?: string
          previous_handler_id?: string | null
          previous_handler_role?: string | null
        }
        Relationships: []
      }
      complaint_feedback: {
        Row: {
          comment: string | null
          complaint_id: string
          created_at: string
          id: string
          rating: number | null
          satisfied: boolean
          user_id: string
        }
        Insert: {
          comment?: string | null
          complaint_id: string
          created_at?: string
          id?: string
          rating?: number | null
          satisfied: boolean
          user_id: string
        }
        Update: {
          comment?: string | null
          complaint_id?: string
          created_at?: string
          id?: string
          rating?: number | null
          satisfied?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_feedback_complaint_id_fkey"
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
      complaint_types: {
        Row: {
          category_id: string
          code: string
          created_at: string
          default_department_code: string | null
          default_priority: Database["public"]["Enums"]["complaint_priority"]
          id: string
          name: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          default_department_code?: string | null
          default_priority?: Database["public"]["Enums"]["complaint_priority"]
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          default_department_code?: string | null
          default_priority?: Database["public"]["Enums"]["complaint_priority"]
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "complaint_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          academic_year: string | null
          ai_summary: string | null
          assigned_admin_id: string | null
          assigned_department_id: string | null
          assigned_officer_id: string | null
          attachment_url: string | null
          category: Database["public"]["Enums"]["complaint_category"] | null
          complaint_category_id: string | null
          complaint_type_id: string | null
          created_at: string
          current_handler_id: string | null
          current_handler_role: string | null
          department_id: string | null
          description: string
          escalated_at: string | null
          escalated_by: string | null
          escalation_level: number
          escalation_reason: string | null
          estimated_resolution_hours: number | null
          faculty_id: string | null
          has_new_updates: boolean
          id: string
          is_anonymous: boolean
          priority: Database["public"]["Enums"]["complaint_priority"]
          reference_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          resolution_date: string | null
          resolved_at: string | null
          resolved_by: string | null
          semester: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          sub_category: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          ai_summary?: string | null
          assigned_admin_id?: string | null
          assigned_department_id?: string | null
          assigned_officer_id?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["complaint_category"] | null
          complaint_category_id?: string | null
          complaint_type_id?: string | null
          created_at?: string
          current_handler_id?: string | null
          current_handler_role?: string | null
          department_id?: string | null
          description: string
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          estimated_resolution_hours?: number | null
          faculty_id?: string | null
          has_new_updates?: boolean
          id?: string
          is_anonymous?: boolean
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resolution_date?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          semester?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          sub_category?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string | null
          ai_summary?: string | null
          assigned_admin_id?: string | null
          assigned_department_id?: string | null
          assigned_officer_id?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["complaint_category"] | null
          complaint_category_id?: string | null
          complaint_type_id?: string | null
          created_at?: string
          current_handler_id?: string | null
          current_handler_role?: string | null
          department_id?: string | null
          description?: string
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          estimated_resolution_hours?: number | null
          faculty_id?: string | null
          has_new_updates?: boolean
          id?: string
          is_anonymous?: boolean
          priority?: Database["public"]["Enums"]["complaint_priority"]
          reference_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resolution_date?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          semester?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          sub_category?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_complaint_category_id_fkey"
            columns: ["complaint_category_id"]
            isOneToOne: false
            referencedRelation: "complaint_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_complaint_type_id_fkey"
            columns: ["complaint_type_id"]
            isOneToOne: false
            referencedRelation: "complaint_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_staff: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_staff_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          department_code: string
          department_email: string | null
          department_name: string
          description: string | null
          faculty_id: string
          hod_name: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          department_code: string
          department_email?: string | null
          department_name: string
          description?: string | null
          faculty_id: string
          hod_name?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          department_code?: string
          department_email?: string | null
          department_name?: string
          description?: string | null
          faculty_id?: string
          hod_name?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          created_at: string
          description: string | null
          faculty_code: string
          faculty_name: string
          id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          faculty_code: string
          faculty_name: string
          id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          faculty_code?: string
          faculty_name?: string
          id?: string
        }
        Relationships: []
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
          department_id: string | null
          display_name: string
          email: string | null
          faculty_id: string | null
          full_name: string | null
          id: string
          level: string | null
          phone_number: string | null
          profile_completed: boolean
          programme: string | null
          staff_position: string | null
          student_id: string | null
          student_index_number: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          department_id?: string | null
          display_name: string
          email?: string | null
          faculty_id?: string | null
          full_name?: string | null
          id: string
          level?: string | null
          phone_number?: string | null
          profile_completed?: boolean
          programme?: string | null
          staff_position?: string | null
          student_id?: string | null
          student_index_number?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          department_id?: string | null
          display_name?: string
          email?: string | null
          faculty_id?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          phone_number?: string | null
          profile_completed?: boolean
          programme?: string | null
          staff_position?: string | null
          student_id?: string | null
          student_index_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
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
      escalate_complaint: {
        Args: { _complaint_id: string; _reason: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dept_staff_for: {
        Args: { _dept: string; _user_id: string }
        Returns: boolean
      }
      is_faculty_admin_for: {
        Args: { _faculty: string; _user_id: string }
        Returns: boolean
      }
      is_hod_for: {
        Args: { _dept: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "department_admin"
        | "hod"
        | "faculty_admin"
        | "super_admin"
      complaint_category:
        | "academic"
        | "infrastructure"
        | "administrative"
        | "other"
      complaint_priority: "low" | "medium" | "high" | "critical"
      complaint_status:
        | "pending"
        | "in_review"
        | "resolved"
        | "closed"
        | "rejected"
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
    Enums: {
      app_role: [
        "admin",
        "department_admin",
        "hod",
        "faculty_admin",
        "super_admin",
      ],
      complaint_category: [
        "academic",
        "infrastructure",
        "administrative",
        "other",
      ],
      complaint_priority: ["low", "medium", "high", "critical"],
      complaint_status: [
        "pending",
        "in_review",
        "resolved",
        "closed",
        "rejected",
      ],
    },
  },
} as const
