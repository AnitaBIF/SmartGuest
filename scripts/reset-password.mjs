import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ukfxitozzuzgfbhsqpgm.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supabase.auth.admin.updateUserById(
  "3ff721cd-310a-49a2-b76b-677cfdb1e5b8",
  { password: "Admin1234!" }
);

if (error) {
  console.error("Error:", error.message);
} else {
  console.log("✓ Contraseña actualizada. Usá: Admin1234!");
}
