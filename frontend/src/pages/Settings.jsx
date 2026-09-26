import {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/settings.css";

const DEFAULT_SETTINGS = {
  language: "English",
  location: "",
};

const DEFAULT_PROFILE = {
  email: "",
  phone: "",
};

function Settings() {
  const navigate =
    useNavigate();

  const [
    settings,
    setSettings,
  ] = useState(
    DEFAULT_SETTINGS
  );

  const [
    profile,
    setProfile,
  ] = useState(
    DEFAULT_PROFILE
  );

  const [
    editingPreference,
    setEditingPreference,
  ] = useState(null);

  const [
    draftValue,
    setDraftValue,
  ] = useState("");

  const [
    showAbout,
    setShowAbout,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth
            .getUser();

        if (
          userError ||
          !user
        ) {
          throw new Error(
            "Your session could not be verified."
          );
        }

        const {
          data:
            profileRow,
          error:
            profileError,
        } =
          await supabase
            .from("profiles")
            .select(
              `
                email,
                phone,
                preferred_language,
                location
              `
            )
            .eq(
              "id",
              user.id
            )
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!mounted) {
          return;
        }

        setProfile({
          email:
            profileRow
              ?.email ||
            user.email ||
            "",
          phone:
            profileRow
              ?.phone ||
            "",
        });

        setSettings({
          language:
            profileRow
              ?.preferred_language ||
            "English",
          location:
            profileRow
              ?.location ||
            "",
        });

        try {
          localStorage.removeItem(
            "verdict-profile"
          );

          localStorage.removeItem(
            "verdict-settings"
          );

          localStorage.removeItem(
            "verdict-calendar-events"
          );
        } catch (
          storageError
        ) {
          console.error(
            "Unable to remove old local caches:",
            storageError
          );
        }
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load settings:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your settings right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  function openPreference(
    field
  ) {
    setEditingPreference(
      field
    );

    setDraftValue(
      settings[field] ||
        ""
    );

    setError("");
    setNotice("");
  }

  function closePreference() {
    if (saving) {
      return;
    }

    setEditingPreference(
      null
    );

    setDraftValue("");
    setError("");
  }

  async function handlePreferenceSave(
    event
  ) {
    event.preventDefault();

    if (
      !editingPreference ||
      saving
    ) {
      return;
    }

    const cleanedValue =
      draftValue.trim();

    if (
      editingPreference ===
        "language" &&
      !cleanedValue
    ) {
      setError(
        "Please choose a language."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Your session could not be verified."
        );
      }

      const databaseField =
        editingPreference ===
        "language"
          ? "preferred_language"
          : "location";

      const {
        data:
          updatedProfile,
        error:
          updateError,
      } =
        await supabase
          .from("profiles")
          .update({
            [databaseField]:
              cleanedValue ||
              null,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            user.id
          )
          .select(
            `
              preferred_language,
              location
            `
          )
          .single();

      if (updateError) {
        throw updateError;
      }

      setSettings({
        language:
          updatedProfile
            .preferred_language ||
          "English",
        location:
          updatedProfile
            .location ||
          "",
      });

      setEditingPreference(
        null
      );

      setDraftValue("");

      setNotice(
        editingPreference ===
          "language"
          ? "Language preference saved."
          : "Location preference saved."
      );
    } catch (
      saveError
    ) {
      console.error(
        "Unable to save setting:",
        saveError
      );

      setError(
        "We couldn't save this preference. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setError("");

    try {
      const {
        error:
          logoutError,
      } =
        await supabase.auth
          .signOut();

      if (logoutError) {
        throw logoutError;
      }

      try {
        localStorage.removeItem(
          "verdict-profile"
        );

        localStorage.removeItem(
          "verdict-settings"
        );

        localStorage.removeItem(
          "verdict-calendar-events"
        );

        localStorage.removeItem(
          "verdict-current-matter"
        );
      } catch (
        storageError
      ) {
        console.error(
          "Unable to clear local Verdict data:",
          storageError
        );
      }

      navigate(
        "/login",
        {
          replace: true,
        }
      );
    } catch (
      logoutError
    ) {
      console.error(
        "Unable to log out:",
        logoutError
      );

      setError(
        "We couldn't log you out. Please try again."
      );

      setLoggingOut(false);
    }
  }

  return (
    <main className="settings-page">
      <section className="settings-shell">
        <header className="settings-header">
          <button
            type="button"
            className="settings-back"
            onClick={() =>
              navigate(
                "/profile"
              )
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="settings-wordmark">
            VERDICT
          </span>

          <div className="settings-header-space" />
        </header>

        <section className="settings-title">
          <span className="settings-eyebrow">
            Account
            preferences
          </span>

          <h1>
            Settings
          </h1>

          <p>
            Manage your account,
            privacy and Verdict
            preferences.
          </p>
        </section>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && (
          <article
            className="settings-notice"
            role="status"
          >
            <span>
              ✓
            </span>

            <div>
              <strong>
                {notice}
              </strong>
            </div>
          </article>
        )}

        <section className="settings-section">
          <span className="section-label">
            Account
          </span>

          <div className="settings-list">
            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/profile"
                )
              }
              disabled={
                loading
              }
            >
              <div>
                <span>
                  Email address
                </span>

                <strong>
                  {loading
                    ? "Loading..."
                    : profile.email ||
                      "Email not added"}
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/forgot-password"
                )
              }
            >
              <div>
                <span>
                  Password
                </span>

                <strong>
                  Change or reset
                  your password
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/profile"
                )
              }
              disabled={
                loading
              }
            >
              <div>
                <span>
                  Phone number
                </span>

                <strong>
                  {loading
                    ? "Loading..."
                    : profile.phone ||
                      "Not added"}
                </strong>
              </div>

              <span>
                →
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <span className="section-label">
            Preferences
          </span>

          <div className="settings-list">
            <button
              type="button"
              className="settings-row"
              onClick={() =>
                openPreference(
                  "language"
                )
              }
              disabled={
                loading
              }
            >
              <div>
                <span>
                  Language
                </span>

                <strong>
                  {loading
                    ? "Loading..."
                    : settings
                        .language}
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/notifications"
                )
              }
            >
              <div>
                <span>
                  Notifications
                </span>

                <strong>
                  Manage reminders
                  and alerts
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                openPreference(
                  "location"
                )
              }
              disabled={
                loading
              }
            >
              <div>
                <span>
                  Location
                </span>

                <strong>
                  {loading
                    ? "Loading..."
                    : settings
                        .location ||
                      "Not set"}
                </strong>
              </div>

              <span>
                →
              </span>
            </button>
          </div>
        </section>

        {editingPreference && (
          <section className="settings-section">
            <span className="section-label">
              Update preference
            </span>

            <form
              className="settings-edit-form"
              onSubmit={
                handlePreferenceSave
              }
            >
              {editingPreference ===
              "language" ? (
                <label>
                  <span>
                    Language
                  </span>

                 <select
  value={draftValue}
  disabled={saving}
  onChange={(event) =>
    setDraftValue(
      event.target.value
    )
  }
>
  <option>English</option>
  <option>isiZulu</option>
  <option>isiXhosa</option>
  <option>Afrikaans</option>
  <option>Sepedi</option>
  <option>Setswana</option>
  <option>Sesotho</option>
  <option>Tsonga</option>
  <option>siSwati</option>
  <option>Tshivenda</option>
  <option>isiNdebele</option>
  <option>
    South African Sign Language
  </option>
</select>
                </label>
              ) : (
                <label>
                  <span>
                    Location
                  </span>

                  <input
                    type="text"
                    value={
                      draftValue
                    }
                    disabled={
                      saving
                    }
                    onChange={(
                      event
                    ) =>
                      setDraftValue(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="For example: North West"
                  />
                </label>
              )}

              <div className="settings-edit-actions">
                <button
                  type="button"
                  onClick={
                    closePreference
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Save"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="settings-section">
          <span className="section-label">
            Privacy & legal
          </span>

          <div className="settings-list">
            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/privacy"
                )
              }
            >
              <div>
                <span>
                  Privacy
                </span>

                <strong>
                  How Verdict
                  handles your
                  information
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/terms/full"
                )
              }
            >
              <div>
                <span>
                  Terms &
                  Conditions
                </span>

                <strong>
                  Review Verdict's
                  terms
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              disabled
              aria-disabled="true"
            >
              <div>
                <span>
                  Data & account
                </span>

                <strong>
                  Data export and
                  account deletion
                  are being
                  prepared
                </strong>
              </div>

              <span>
                —
              </span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <span className="section-label">
            Support
          </span>

          <div className="settings-list">
            <button
              type="button"
              className="settings-row"
              onClick={() =>
                navigate(
                  "/support"
                )
              }
            >
              <div>
                <span>
                  Help & Support
                </span>

                <strong>
                  Get help using
                  Verdict
                </strong>
              </div>

              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="settings-row"
              onClick={() =>
                setShowAbout(
                  (current) =>
                    !current
                )
              }
            >
              <div>
                <span>
                  About Verdict
                </span>

                <strong>
                  Version and
                  product
                  information
                </strong>
              </div>

              <span>
                {showAbout
                  ? "↑"
                  : "→"}
              </span>
            </button>
          </div>
        </section>

        {showAbout && (
          <article className="settings-about">
            <span>
              V
            </span>

            <div>
              <h3>
                Verdict
              </h3>

              <p>
                Verdict is a
                legal-preparation
                platform designed
                to help people
                organise a matter,
                understand
                relevant legal
                information and
                reach appropriate
                human support.
              </p>

              <small>
                Secure development
                build
              </small>
            </div>
          </article>
        )}

        <section className="settings-danger-section">
          <span className="section-label">
            Account actions
          </span>

          <button
            type="button"
            className="settings-logout"
            onClick={
              logout
            }
            disabled={
              loggingOut
            }
          >
            {loggingOut
              ? "Logging out..."
              : "Log out"}
          </button>

          <button
            type="button"
            className="settings-delete"
            disabled
            aria-disabled="true"
          >
            Delete account
          </button>
        </section>

        <article className="settings-notice">
          <span>
            i
          </span>

          <div>
            <strong>
              Your preferences
              are linked to your
              Verdict account.
            </strong>

            <p>
              Language and
              location settings
              are securely synced
              to your signed-in
              profile.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Settings;