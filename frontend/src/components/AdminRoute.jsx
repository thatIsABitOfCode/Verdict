import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Protects Verdict admin routes.
 *
 * Authentication:
 *   Supabase Auth
 *
 * Admin authorization:
 *   public.support_admins
 *
 * This keeps admin authorization in one place instead of making every
 * admin page repeat the same access check.
 */
export default function AdminRoute({ children }) {
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    admin: false,
  });

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (userError || !user) {
          setState({
            loading: false,
            authenticated: false,
            admin: false,
          });
          return;
        }

        const { data, error } = await supabase
          .from("support_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("Unable to verify Verdict admin access:", error);
          setState({
            loading: false,
            authenticated: true,
            admin: false,
          });
          return;
        }

        setState({
          loading: false,
          authenticated: true,
          admin: Boolean(data),
        });
      } catch (error) {
        console.error("Verdict admin access check failed:", error);

        if (active) {
          setState({
            loading: false,
            authenticated: false,
            admin: false,
          });
        }
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f6f3ec",
        }}
      >
        <div>
          <strong>VERDICT ADMIN</strong>
          <p>Checking admin access…</p>
        </div>
      </main>
    );
  }

  if (!state.authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!state.admin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
