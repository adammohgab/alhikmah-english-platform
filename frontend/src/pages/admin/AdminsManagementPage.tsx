import { useState } from "react";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin" | "none";
}

interface Props {
  isSuperAdmin: boolean;
  users: AdminUser[];
  changeRole: (userId: string, role: AdminUser["role"]) => Promise<void>;
}

export default function AdminsManagementPage({ isSuperAdmin, users, changeRole }: Props) {
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<AdminUser["role"]>("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isSuperAdmin) {
    return (
      <main>
        <h1>Access denied</h1>
        <p>Only Super Admins can manage administrator roles.</p>
      </main>
    );
  }

  async function confirm() {
    if (!pending) return;

    setBusy(true);
    setError("");

    try {
      await changeRole(pending.id, role);
      setPending(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Role update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Admins &amp; Roles</h1>
      <p>Role changes should be recorded as immutable audit log entries by the server.</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Email</th>
            <th align="left">Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role.replace("_", " ")}</td>
              <td>
                <button
                  onClick={() => {
                    setPending(user);
                    setRole(user.role === "admin" ? "super_admin" : "admin");
                    setError("");
                  }}
                >
                  {user.role === "none" ? "Assign role" : "Change / revoke role"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "#0008",
            display: "grid",
            placeItems: "center",
          }}
        >
          <section style={{ background: "white", padding: 24, borderRadius: 12 }}>
            <h2 id="role-title">Change role for {pending.name}</h2>
            <label>
              New role{" "}
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as AdminUser["role"])}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="none">Revoke access</option>
              </select>
            </label>
            <p>This change will be saved and audited.</p>
            {error && <p role="alert">{error}</p>}
            <button disabled={busy} onClick={confirm}>
              {busy ? "Saving…" : "Confirm change"}
            </button>{" "}
            <button disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
