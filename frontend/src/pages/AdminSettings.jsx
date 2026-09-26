import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatDate(value) {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Not available";
  }
}

function AdminSettings() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [profile, setProfile] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error("Your admin session could not be verified.");
      }

      const user = session.user;

      const [
        { data: profileRow, error: profileError },
        { data: adminRow, error: adminError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, preferred_language, location, created_at, updated_at"
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("support_admins")
          .select("user_id, created_at")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileError) {
        throw profileError;
      }

      if (adminError) {
        throw adminError;
      }

      if (!adminRow) {
        throw new Error(
          "This account does not currently have Verdict administrator access."
        );
      }

      setAdmin({
        id: user.id,
        email: user.email || profileRow?.email || "",
        provider: user.app_metadata?.provider || "email",
        lastSignInAt: user.last_sign_in_at || null,
        accessGrantedAt: adminRow.created_at || null,
      });

      setProfile({
        fullName: profileRow?.full_name || "",
        email: profileRow?.email || user.email || "",
        phone: profileRow?.phone || "",
        language: profileRow?.preferred_language || "English",
        location: profileRow?.location || "",
        createdAt: profileRow?.created_at || null,
        updatedAt: profileRow?.updated_at || null,
      });

      try {
        const response = await fetch(`${API_URL}/api/admin/ai-health`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const healthData = await response.json();
          setSystemHealth(healthData);
        } else {
          setSystemHealth(null);
        }
      } catch (healthError) {
        console.error(
          "Unable to load safe system configuration:",
          healthError
        );
        setSystemHealth(null);
      }
    } catch (loadError) {
      console.error("Unable to load admin settings:", loadError);

      setError(
        loadError?.message ||
          "We couldn't load the admin settings right now."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) {
        throw logoutError;
      }

      try {
        localStorage.removeItem("verdict-profile");
        localStorage.removeItem("verdict-settings");
        localStorage.removeItem("verdict-calendar-events");
        localStorage.removeItem("verdict-current-matter");
      } catch (storageError) {
        console.error(
          "Unable to clear local Verdict data:",
          storageError
        );
      }

      navigate("/login", { replace: true });
    } catch (logoutError) {
      console.error("Unable to log out:", logoutError);

      setError("We couldn't log you out. Please try again.");
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <section className="admin-settings-page">
        <div className="admin-page-head">
          <div>
            <span className="admin-eyebrow">Administration</span>
            <h1>Settings</h1>
            <p className="admin-page-description">
              Loading your administrator account and Verdict configuration.
            </p>
          </div>
        </div>

        <div className="admin-panel admin-settings-loading">
          Loading settings…
        </div>
      </section>
    );
  }

  return (
    <section className="admin-settings-page">
      <div className="admin-page-head">
        <div>
          <span className="admin-eyebrow">Administration</span>
          <h1>Settings</h1>
          <p className="admin-page-description">
            Review your administrator account, access status and safe Verdict
            system information.
          </p>
        </div>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={loadSettings}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-error-notice">
          <span>{error}</span>

          <button type="button" onClick={loadSettings}>
            Try again
          </button>
        </div>
      )}

      <div className="admin-settings-grid">
        <article className="admin-panel admin-settings-account">
          <div className="admin-panel-head">
            <div>
              <span className="admin-eyebrow">Administrator</span>
              <h2>Admin account</h2>
              <p>
                The account currently authenticated to Verdict Admin.
              </p>
            </div>

            <span className="admin-status-badge is-success">
              Admin access
            </span>
          </div>

          <div className="admin-settings-profile">
            <div className="admin-settings-avatar">
              {(profile?.fullName ||
                admin?.email ||
                "A")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {profile?.fullName || "Verdict Administrator"}
              </strong>

              <span>{admin?.email || "No email available"}</span>
            </div>
          </div>

          <dl className="admin-settings-details">
            <div>
              <dt>Admin access granted</dt>
              <dd>{formatDate(admin?.accessGrantedAt)}</dd>
            </div>

            <div>
              <dt>Last sign in</dt>
              <dd>{formatDate(admin?.lastSignInAt)}</dd>
            </div>

            <div>
              <dt>Authentication provider</dt>
              <dd>{admin?.provider || "Not available"}</dd>
            </div>

            <div>
              <dt>User ID</dt>
              <dd className="admin-mono">{admin?.id}</dd>
            </div>
          </dl>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="admin-eyebrow">Profile</span>
              <h2>Personal preferences</h2>
              <p>
                Personal account information remains managed through the
                normal Verdict profile and settings pages.
              </p>
            </div>
          </div>

          <dl className="admin-settings-details">
            <div>
              <dt>Preferred language</dt>
              <dd>{profile?.language || "English"}</dd>
            </div>

            <div>
              <dt>Location</dt>
              <dd>{profile?.location || "Not provided"}</dd>
            </div>

            <div>
              <dt>Phone</dt>
              <dd>{profile?.phone || "Not provided"}</dd>
            </div>

            <div>
              <dt>Profile updated</dt>
              <dd>{formatDate(profile?.updatedAt)}</dd>
            </div>
          </dl>

          <div className="admin-settings-actions">
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => navigate("/profile")}
            >
              Open Profile
            </button>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => navigate("/settings")}
            >
              User Settings
            </button>
          </div>
        </article>
      </div>

      <article className="admin-panel admin-settings-system">
        <div className="admin-panel-head">
          <div>
            <span className="admin-eyebrow">Verdict system</span>
            <h2>System configuration</h2>
            <p>
              Safe operational information only. Server secrets and API
              credentials are never displayed here.
            </p>
          </div>
        </div>

        <div className="admin-settings-system-grid">
          <div>
            <span>Admin API</span>
            <strong>Connected</strong>
            <small>
              This page is operating through an authenticated Verdict admin
              session.
            </small>
          </div>

          <div>
            <span>AI routing</span>
            <strong>
              {systemHealth?.overall?.status === "configured"
                ? "Configured"
                : systemHealth
                  ? "Not configured"
                  : "Unavailable"}
            </strong>
            <small>
              {systemHealth
                ? `${systemHealth.overall?.configuredProviders ?? 0} of ${
                    systemHealth.overall?.totalProviders ?? 0
                  } providers configured.`
                : "AI configuration information could not be loaded."}
            </small>
          </div>

          <div>
            <span>Legal grounding</span>
            <strong>
              {systemHealth?.safeguards?.legalGroundingRequired
                ? "Required"
                : systemHealth
                  ? "Check configuration"
                  : "Unavailable"}
            </strong>
            <small>
              Verdict's legal guidance remains bounded by verified legal
              knowledge.
            </small>
          </div>

          <div>
            <span>Browser secrets</span>
            <strong>
              {systemHealth?.safeguards?.secretsExposed === false
                ? "Protected"
                : systemHealth
                  ? "Check configuration"
                  : "Not inspected"}
            </strong>
            <small>
              Provider API keys and privileged server credentials should
              remain server-side.
            </small>
          </div>
        </div>

        <div className="admin-settings-system-action">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => navigate("/admin/ai-health")}
          >
            Open AI & Product Health
          </button>
        </div>
      </article>

      <article className="admin-panel admin-settings-security">
        <div>
          <span className="admin-eyebrow">Session security</span>
          <h2>Administrator session</h2>
          <p>
            Signing out ends the current Verdict session. You will need to
            authenticate again before accessing either the user app or the
            admin workspace.
          </p>
        </div>

        <button
          type="button"
          className="admin-settings-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Signing out…" : "Log out"}
        </button>
      </article>

      <div className="admin-info-notice admin-settings-boundary">
        <strong>Configuration boundary</strong>

        <span>
          Verdict does not currently maintain a general-purpose system
          settings table. This page therefore does not present controls that
          would falsely imply they change backend behaviour.
        </span>
      </div>
    </section>
  );
}

export default AdminSettings;