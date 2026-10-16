import React, { useState } from "react";

export interface PlatformSettings {
  emergencyMaintenance: boolean;
  publicRegistration: boolean;
  defaultWorldTheme: string;
}

interface Props {
  isSuperAdmin: boolean;
  initial: PlatformSettings;
  verifyPassword: (password: string) => Promise<boolean>;
  save: (settings: PlatformSettings) => Promise<void>;
}

export default function PlatformSettingsPage({
  isSuperAdmin,
  initial,
  verifyPassword,
  save,
}: Props) {
  const [settings, setSettings] = useState(initial);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!isSuperAdmin) {
    return (
      <main>
        <h1>Access denied</h1>
        <p>Platform settings are restricted to Super Admins.</p>
      </main>
    );
  }

  const toggle = (key: "emergencyMaintenance" | "publicRegistration") =>
    setSettings((current) => ({ ...current, [key]: !current[key] }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (!(await verifyPassword(password))) {
        throw new Error("Password verification failed.");
      }

      await save(settings);
      setMessage("Settings saved. Maintenance state is now published.");
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Platform Settings</h1>
      <p>Changes affect the whole platform. Confirm your password before saving.</p>

      <form onSubmit={(event) => {
          void submit(event);
        }}>
        <label style={{ display: "block", padding: 16 }}>
          <input
            type="checkbox"
            checked={settings.emergencyMaintenance}
            onChange={() => toggle("emergencyMaintenance")}
          />{" "}
          Emergency Maintenance Mode
          <small> Show a friendly maintenance notice and block non-admin access.</small>
        </label>

        <label style={{ display: "block", padding: 16 }}>
          <input
            type="checkbox"
            checked={settings.publicRegistration}
            onChange={() => toggle("publicRegistration")}
          />{" "}
          Public Registration Allowed
        </label>

        <label style={{ display: "block", padding: 16 }}>
          Default World Theme{" "}
          <select
            value={settings.defaultWorldTheme}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                defaultWorldTheme: event.target.value,
              }))
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="nature">Nature</option>
            <option value="space">Space</option>
          </select>
        </label>

        <label>
          Password verification{" "}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <p>
          <button disabled={busy}>{busy ? "Saving…" : "Verify and save"}</button> {message}
        </p>
      </form>
    </main>
  );
}
