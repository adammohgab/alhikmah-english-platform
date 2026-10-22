import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_SETTINGS, parseNotificationPrefs, toSettings } from "./api";
import { validateChangeAll, validateChangeField } from "./change-password";

describe("ST-31 settings parsing", () => {
  it("keeps defaults for a missing or malformed JSON bag", () => {
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(parseNotificationPrefs({ notifications: { streakReminders: "no", reminderTime: "25:00" } })).toEqual(
      DEFAULT_NOTIFICATION_PREFS,
    );
  });

  it("reads saved switches, reminder time and volume", () => {
    const settings = toSettings({
      sound_enabled: false,
      effects_tier: "high",
      prefers_reduced_motion: true,
      notifications_json: {
        notifications: { newBadges: false, reminderTime: "07:30" },
        audio: { volume: 2 },
      },
    });
    expect(settings.exists).toBe(true);
    expect(settings.soundEnabled).toBe(false);
    expect(settings.effectsTier).toBe("high");
    expect(settings.reducedMotion).toBe(true);
    expect(settings.volume).toBe(1);
    expect(settings.notifications.newBadges).toBe(false);
    expect(settings.notifications.reminderTime).toBe("07:30");
  });

  it("ignores an unknown tier so the automatic tier stays in charge", () => {
    expect(toSettings({ effects_tier: "ultra" }).effectsTier).toBeNull();
    expect(toSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("ST-31 change password validation", () => {
  const good = { current: "Old#pass1", password: "New#pass22", confirm: "New#pass22" };

  it("accepts a valid change", () => {
    expect(validateChangeAll(good, "student1")).toEqual({});
  });

  it("requires the current password and a matching confirmation", () => {
    const errors = validateChangeAll({ current: "", password: "New#pass22", confirm: "other" }, "student1");
    expect(errors.current).toBeDefined();
    expect(errors.confirm).toBeDefined();
  });

  it("rejects weak passwords and reuse of the current one", () => {
    expect(validateChangeField("password", { ...good, password: "short" }, "student1")).toBeDefined();
    expect(validateChangeField("password", { ...good, password: good.current }, "student1")).toBeDefined();
  });
});
