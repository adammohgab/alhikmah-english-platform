export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Portal roles used by the app. A database `super_admin` maps to `admin` plus an admin level. */
export type UserRole = "student" | "teacher" | "admin";
/** Values of the `user_role` enum in the database. */
export type DbUserRole = UserRole | "super_admin";
export type AdminLevel = "school_admin" | "super_admin";
export type AccountStatus = "active" | "locked" | "archived" | "disabled";

export interface Database {
  public: {
    Tables: {
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          version: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          /** Read-only alias of display_name. */
          full_name: string;
          role: DbUserRole;
          status: AccountStatus;
          avatar_url: string | null;
          equipped_theme: string | null;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          role?: DbUserRole;
          status?: AccountStatus;
          avatar_url?: string | null;
          equipped_theme?: string | null;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          role?: DbUserRole;
          status?: AccountStatus;
          avatar_url?: string | null;
          equipped_theme?: string | null;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          id: string;
          student_id: string;
          lesson_id: string;
          course_id: string | null;
          is_completed: boolean;
          status: string;
          completed_at: string | null;
          first_completed_at: string | null;
          last_accessed_at: string;
          last_opened_at: string;
          notes: string | null;
          xp_awarded: boolean;
        };
        Insert: {
          id?: string;
          student_id: string;
          lesson_id: string;
          course_id?: string | null;
          is_completed?: boolean;
          status?: string;
          completed_at?: string | null;
          first_completed_at?: string | null;
          last_accessed_at?: string;
          last_opened_at?: string;
          notes?: string | null;
          xp_awarded?: boolean;
        };
        Update: {
          id?: string;
          student_id?: string;
          lesson_id?: string;
          course_id?: string | null;
          is_completed?: boolean;
          status?: string;
          completed_at?: string | null;
          first_completed_at?: string | null;
          last_accessed_at?: string;
          last_opened_at?: string;
          notes?: string | null;
          xp_awarded?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      v_public_settings: {
        Row: {
          platform_name: string | null;
          school_name: string | null;
          logo_asset_id: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          office_hours: string | null;
          location: string | null;
          maintenance: Json | null;
          security: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_platform_settings: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      save_student_avatar: {
        Args: { p_avatar_url: string };
        Returns: undefined;
      };
      request_password_reset: {
        Args: {
          p_username: string;
          p_full_name: string;
          p_grade_class?: string | null;
          p_note?: string | null;
          p_device_key?: string | null;
        };
        Returns: Json;
      };
      complete_password_change: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      award_xp: {
        Args: {
          student_id: string;
          amount: number;
          source: string;
          ref_id: string | null;
        };
        Returns: {
          student_id?: string;
          requested_xp?: number;
          awarded_xp?: number;
          daily_xp_cap?: number;
          xp_earned_today?: number;
          capped?: boolean;
          total_xp?: number;
          level_before?: number;
          level_after?: number;
          level_up_bonus_coins?: number;
          current_coins?: number;
          xp_ledger_id?: string | null;
        } | null;
      };
      add_words_to_library: {
        Args: {
          items: Array<{
            word: string;
            part_of_speech?: string | null;
            meaning?: string | null;
            arabic_meaning?: string | null;
            example?: string | null;
            vocab_item_id?: string | null;
          }>;
          from: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: DbUserRole;
      user_status: AccountStatus;
    };
  };
}
