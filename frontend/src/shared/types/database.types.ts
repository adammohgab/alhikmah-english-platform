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
    };
    Enums: {
      user_role: DbUserRole;
      user_status: AccountStatus;
    };
  };
}
