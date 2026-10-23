import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPERADMIN_PASSWORD",
  "SUPERADMIN_USERNAME",
  "SUPERADMIN_DISPLAY_NAME",
];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const username = process.env.SUPERADMIN_USERNAME.trim().toLowerCase();
const displayName = process.env.SUPERADMIN_DISPLAY_NAME.trim();
const password = process.env.SUPERADMIN_PASSWORD;

// The app's login flow maps usernames to this synthetic Auth email domain.
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  throw new Error("Username must be 3–32 lowercase letters, digits, dots, underscores, or hyphens.");
}
if (password.length < 14) {
  throw new Error("SUPERADMIN_PASSWORD must be at least 14 characters long.");
}
if (!displayName) {
  throw new Error("Display name must not be empty.");
}
const authEmail = `${username}@accounts.invalid`;

// Supabase JS expects the bare project URL. If the GitHub secret was copied
// from an API endpoint such as /rest/v1 or /auth/v1, normalize it so the
// client does not construct invalid URLs. Query strings and fragments are
// rejected rather than silently discarded.
function normalizeSupabaseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("SUPABASE_URL must be a valid Supabase project URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }
  if (url.search || url.hash) {
    throw new Error("SUPABASE_URL must not contain a query string or fragment.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/rest/v1" || path === "/auth/v1") {
    url.pathname = "";
    return url.toString().replace(/\/$/, "");
  }
  throw new Error("SUPABASE_URL must be the bare project URL, without /rest/v1, /auth/v1, or another path.");
}

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Unable to list Auth users: ${error.message}`);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === targetEmail,
    );
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Stopped after 100 Auth user pages; refusing to guess.");
}

const { data: existingAdmins, error: adminCheckError } = await supabase
  .from("profiles")
  .select("id, username")
  .eq("role", "super_admin")
  .limit(2);

if (adminCheckError) {
  throw new Error(`Unable to verify existing Super Admins: ${adminCheckError.message}`);
}

let user = await findUserByEmail(authEmail);
if (existingAdmins?.length) {
  if (user && existingAdmins.some((admin) => admin.id === user.id)) {
    console.log("The configured username already has a Super Admin profile. No changes made.");
    process.exit(0);
  }
  throw new Error(
    "A Super Admin already exists for another account. Refusing to create or promote another account automatically.",
  );
}

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Unable to create Auth user: ${error.message}`);
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Unable to update configured Auth user: ${error.message}`);
  user = data.user;
}

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    id: user.id,
    username,
    display_name: displayName,
    role: "super_admin",
    status: "active",
    must_change_password: true,
  },
  { onConflict: "id" },
);

if (profileError) {
  throw new Error(
    `Auth user was created/updated, but profile creation failed: ${profileError.message}. Fix the profile issue before rerunning.`,
  );
}

console.log("Super Admin bootstrap completed.");
console.log(`Username: ${username}`);
console.log("Password: stored only as a GitHub Actions secret; it is not printed.");
console.log("Sign in with the username and configured password.");
