import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

function getDisplayName(user) {
  const metadata = user.user_metadata || {};

  return (
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    metadata.first_name ||
    user.email?.split("@")[0] ||
    "Verdict user"
  );
}

/**
 * GET /api/admin/users
 *
 * Returns a safe, admin-facing projection of Supabase Auth users.
 * This route never returns password data, tokens, identities, or raw metadata.
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      console.error("Unable to list Verdict users:", usersError);

      return res.status(500).json({
        error: "Unable to load users.",
      });
    }

    const { data: adminRows, error: adminRowsError } = await supabaseAdmin
      .from("support_admins")
      .select("user_id");

    if (adminRowsError) {
      console.error("Unable to load Verdict admin records:", adminRowsError);

      return res.status(500).json({
        error: "Unable to load admin roles.",
      });
    }

    const adminIds = new Set(
      (adminRows || []).map((row) => row.user_id)
    );

    const users = (usersData?.users || []).map((user) => ({
      id: user.id,
      displayName: getDisplayName(user),
      email: user.email || null,
      phone: user.phone || null,
      provider:
        user.app_metadata?.provider ||
        user.app_metadata?.providers?.[0] ||
        null,
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
      emailConfirmedAt: user.email_confirmed_at || null,
      isAdmin: adminIds.has(user.id),
    }));

    users.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Verdict admin users route failed:", error);

    return res.status(500).json({
      error: "Unable to load users.",
    });
  }
});

export default router;
