import { createSupabaseClient } from "../lib/supabase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

/**
 * Require a signed-in Verdict support admin.
 *
 * The caller's JWT is validated with the normal publishable-key client.
 * Authorization is then checked against public.support_admins.
 *
 * The service-role client is used only after both checks succeed.
 */
export async function requireAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const supabase = createSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from("support_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Verdict admin authorization failed:", adminError);

      return res.status(500).json({
        error: "Unable to verify admin access.",
      });
    }

    if (!adminRecord) {
      return res.status(403).json({
        error: "Admin access required.",
      });
    }

    req.verdictAdmin = {
      id: user.id,
      email: user.email || null,
    };

    next();
  } catch (error) {
    console.error("Verdict admin middleware failed:", error);

    return res.status(500).json({
      error: "Unable to verify admin access.",
    });
  }
}
