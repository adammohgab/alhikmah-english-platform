import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPERADMIN_EMAIL",
  "SUPERADMIN_PASSWORD",
  "SUPERADMIN_USERNAME",
  "SUPERADMIN_DISPLAY_NAME",
];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const email = process.env.SUPERADMIN_EMAIL.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const username = process.env.SUPERADMIN_USERNAME.trim();
const displayName = process.env.SUPERADMIN_DISPLAY_NAME.trim();

if (password.length < 14) {
  throw new Error("SUPERADMIN_PASSWORD must be at least 14 characters long.");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("SUPERADMIN_EMAIL is not a valid email address.");
}
if (!username || !displayName) {
  throw new Error("Username and display name must not be empty.");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function findUserByEmail(targetEmail) {
  // Auth admin listUsers is paginated; scan pages instead of assuming the
  // configured account is among the first users.
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
if (existingAdmins?.length) {
  const existingUser = await findUserByEmail(email);
  if (existingUser && existingAdmins.some((admin) => admin.id === existingUser.id)) {
    console.log("The configured email already has a Super Admin profile. No changes made.");
    process.exit(0);
  }
  throw new Error(
    "A Super Admin already exists for another account. Refusing to create or promote another account automatically.",
  );
}

let user = await findUserByEmail(email);

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Unable to create Auth user: ${error.message}`);
  user = data.user;
} else {
  // The email is configured as a repository secret by an owner. Update only
  // this explicitly configured account, never an email supplied at dispatch.
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
    `Auth user was created/updated, but profile promotion failed: ${profileError.message}. Rerun this workflow after fixing the profile issue.`,
  );
}

console.log("Super Admin bootstrap completed.");
console.log(`Email: ${email}`);
console.log(`Username: ${username}`);
console.log("A password change is required by the profile flag; use the app's supported password-change flow if enabled.");
