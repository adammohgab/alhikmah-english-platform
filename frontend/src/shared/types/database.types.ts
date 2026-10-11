export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "student" | "teacher" | "admin";
export type AdminLevel = "school_admin" | "super_admin";
export type AccountStatus = "active" | "archived" | "disabled";

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
          full_name: string;
          role: UserRole;
          admin_level: AdminLevel | null;
          status: AccountStatus;
          must_change_password: boolean;
          grade_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role: UserRole;
          admin_level?: AdminLevel | null;
          status?: AccountStatus;
          must_change_password?: boolean;
          grade_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          role?: UserRole;
          admin_level?: AdminLevel | null;
          status?: AccountStatus;
          must_change_password?: boolean;
          grade_id?: string | null;
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
    };
    Enums: {
      user_role: UserRole;
      admin_level: AdminLevel;
      account_status: AccountStatus;
    };
  };
}
