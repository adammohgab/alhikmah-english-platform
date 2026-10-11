import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";

export interface MaintenanceSettings {
  enabled: boolean;
  message?: string | undefined;
  expected_back_at?: string | null | undefined;
}

export interface FeatureFlag {
  enabled: boolean;
  grades?: string[] | null | undefined;
}

export interface FeaturesSettings {
  games?: FeatureFlag;
  shop?: FeatureFlag;
  leaderboards?: FeatureFlag;
  avatars_themes?: FeatureFlag;
  certificates?: FeatureFlag;
  translation?: FeatureFlag;
  announcements?: FeatureFlag;
  practice_libraries?: FeatureFlag;
  ai_tutor?: FeatureFlag;
  [key: string]: FeatureFlag | undefined;
}

export interface PlatformSettingsState {
  maintenance: MaintenanceSettings;
  registration_enabled: boolean;
  ai_features_enabled: boolean;
  sound_enabled_default: boolean;
  features: FeaturesSettings;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsState = {
  maintenance: {
    enabled: false,
    message: "Platform is undergoing scheduled maintenance.",
    expected_back_at: null,
  },
  registration_enabled: false,
  ai_features_enabled: true,
  sound_enabled_default: true,
  features: {
    games: { enabled: true },
    shop: { enabled: true },
    leaderboards: { enabled: true },
    avatars_themes: { enabled: true },
    certificates: { enabled: true },
    translation: { enabled: true },
    announcements: { enabled: true },
    practice_libraries: { enabled: true },
    ai_tutor: { enabled: true },
  },
};

/**
 * Fetches platform settings from Supabase platform_settings table.
 */
export async function fetchPlatformSettings(): Promise<PlatformSettingsState> {
  try {
    const { data, error } = await supabase.from("platform_settings").select("key, value");

    if (error || !data) {
      return DEFAULT_PLATFORM_SETTINGS;
    }

    const settingsMap: Record<string, unknown> = {};
    for (const item of data) {
      settingsMap[item.key] = item.value;
    }

    const maintenanceRaw = settingsMap["maintenance"] as Partial<MaintenanceSettings> | undefined;
    const featuresRaw = settingsMap["features"] as FeaturesSettings | undefined;
    const preferencesRaw = settingsMap["preferences"] as Record<string, unknown> | undefined;

    return {
      maintenance: {
        enabled: Boolean(maintenanceRaw?.enabled),
        message: maintenanceRaw?.message ?? DEFAULT_PLATFORM_SETTINGS.maintenance.message,
        expected_back_at: maintenanceRaw?.expected_back_at ?? null,
      },
      registration_enabled: Boolean(preferencesRaw?.["registration_enabled"] ?? false),
      ai_features_enabled:
        typeof featuresRaw?.ai_tutor?.enabled === "boolean"
          ? featuresRaw.ai_tutor.enabled
          : DEFAULT_PLATFORM_SETTINGS.ai_features_enabled,
      sound_enabled_default:
        typeof preferencesRaw?.["sound_enabled_default"] === "boolean"
          ? preferencesRaw["sound_enabled_default"]
          : DEFAULT_PLATFORM_SETTINGS.sound_enabled_default,
      features: {
        ...DEFAULT_PLATFORM_SETTINGS.features,
        ...(featuresRaw ?? {}),
      },
    };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/**
 * Hook to query active platform configuration with fallback to safe defaults.
 */
export function usePlatformSettings() {
  const query = useQuery({
    queryKey: ["platform-settings"],
    queryFn: fetchPlatformSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15,
    initialData: DEFAULT_PLATFORM_SETTINGS,
  });

  const settings = query.data ?? DEFAULT_PLATFORM_SETTINGS;

  const isFeatureEnabled = (featureKey: string): boolean => {
    // Check specific feature in features map
    const feature = settings.features[featureKey];
    if (feature && typeof feature.enabled === "boolean") {
      return feature.enabled;
    }

    // Common top-level flags
    if (featureKey === "registration") {
      return settings.registration_enabled;
    }
    if (featureKey === "ai_features" || featureKey === "ai") {
      return settings.ai_features_enabled;
    }
    if (featureKey === "sound") {
      return settings.sound_enabled_default;
    }

    return false;
  };

  return {
    settings,
    isFeatureEnabled,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Convenience alias for feature toggles.
 */
export function useFeatures() {
  const { isFeatureEnabled, settings, isLoading } = usePlatformSettings();
  return {
    isFeatureEnabled,
    features: settings.features,
    isLoading,
  };
}
