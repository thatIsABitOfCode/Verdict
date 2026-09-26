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

import "../styles/profile.css";

const EMPTY_PROFILE = {
  name: "",
  email: "",
  phone: "",
  preferredLanguage: "English",
  location: "",
};

function Profile() {
  const navigate =
    useNavigate();

  const [
    profile,
    setProfile,
  ] = useState(
    EMPTY_PROFILE
  );

  const [
    draftProfile,
    setDraftProfile,
  ] = useState(
    EMPTY_PROFILE
  );

  const [
    editing,
    setEditing,
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
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    activeMatterCount,
    setActiveMatterCount,
  ] = useState(0);

  const [
    calendarItemCount,
    setCalendarItemCount,
  ] = useState(0);

  const [
    evidenceCount,
    setEvidenceCount,
  ] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
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

        const [
          profileResult,
          mattersResult,
          calendarResult,
          evidenceResult,
        ] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                `
                  id,
                  full_name,
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
              .maybeSingle(),

            supabase
              .from("matters")
              .select(
                "id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "user_id",
                user.id
              )
              .eq(
                "status",
                "in_progress"
              ),

            supabase
              .from(
                "calendar_events"
              )
              .select(
                "id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from("evidence")
              .select(
                "id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "user_id",
                user.id
              ),
          ]);

        if (
          profileResult.error
        ) {
          throw profileResult.error;
        }

        if (
          mattersResult.error
        ) {
          throw mattersResult.error;
        }

        if (
          calendarResult.error
        ) {
          throw calendarResult.error;
        }

        if (
          evidenceResult.error
        ) {
          throw evidenceResult.error;
        }

        if (!mounted) {
          return;
        }

        const profileRow =
          profileResult.data;

        const loadedProfile = {
          name:
            profileRow
              ?.full_name ||
            user.user_metadata
              ?.full_name ||
            "",
          email:
            profileRow
              ?.email ||
            user.email ||
            "",
          phone:
            profileRow
              ?.phone ||
            "",
          preferredLanguage:
            profileRow
              ?.preferred_language ||
            "English",
          location:
            profileRow
              ?.location ||
            "",
        };

        setProfile(
          loadedProfile
        );

        setDraftProfile(
          loadedProfile
        );

        setActiveMatterCount(
          mattersResult.count ||
            0
        );

        setCalendarItemCount(
          calendarResult.count ||
            0
        );

        setEvidenceCount(
          evidenceResult.count ||
            0
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load profile:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load your profile right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const displayName =
    profile.name.trim() ||
    "Your name";

  const displayEmail =
    profile.email.trim() ||
    "Email not added";

  const avatarLetter =
    profile.name.trim()
      ? profile.name
          .trim()[0]
          .toUpperCase()
      : "V";

  function startEditing() {
    setDraftProfile(
      profile
    );

    setError("");
    setNotice("");
    setEditing(true);
  }

  function cancelEditing() {
    if (saving) {
      return;
    }

    setDraftProfile(
      profile
    );

    setEditing(false);
    setError("");
  }

  function updateDraft(
    field,
    value
  ) {
    setDraftProfile(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    setError("");
    setNotice("");
  }

  async function saveProfile(
    event
  ) {
    event.preventDefault();

    if (saving) {
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

      const cleanedProfile = {
        name:
          draftProfile.name
            .trim(),
        email:
          profile.email,
        phone:
          draftProfile.phone
            .trim(),
        preferredLanguage:
          profile.preferredLanguage,
        location:
          profile.location,
      };

      const {
        data:
          updatedProfile,
        error:
          updateError,
      } =
        await supabase
          .from("profiles")
          .update({
            full_name:
              cleanedProfile
                .name ||
              null,
            phone:
              cleanedProfile
                .phone ||
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
              full_name,
              email,
              phone,
              preferred_language,
              location
            `
          )
          .single();

      if (updateError) {
        throw updateError;
      }

      const nextProfile = {
        name:
          updatedProfile
            .full_name ||
          "",
        email:
          updatedProfile
            .email ||
          user.email ||
          "",
        phone:
          updatedProfile
            .phone ||
          "",
        preferredLanguage:
          updatedProfile
            .preferred_language ||
          "English",
        location:
          updatedProfile
            .location ||
          "",
      };

      setProfile(
        nextProfile
      );

      setDraftProfile(
        nextProfile
      );

      setEditing(false);

      setNotice(
        "Profile updated successfully."
      );

      try {
        localStorage.removeItem(
          "verdict-profile"
        );
      } catch (storageError) {
        console.error(
          "Unable to remove old profile cache:",
          storageError
        );
      }
    } catch (
      saveError
    ) {
      console.error(
        "Unable to save profile:",
        saveError
      );

      setError(
        "We couldn't save your profile changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <header className="profile-header">
          <button
            type="button"
            className="profile-back"
            onClick={() =>
              navigate("/home")
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="profile-wordmark">
            VERDICT
          </span>

          <button
            type="button"
            className="profile-settings"
            onClick={() =>
              navigate(
                "/settings"
              )
            }
            aria-label="Open settings"
          >
            ⚙
          </button>
        </header>

        <section className="profile-title">
          <span className="profile-eyebrow">
            Your account
          </span>

          <h1>
            Profile
          </h1>

          <p>
            Manage your
            personal details
            and account
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
          <div
            className="profile-notice"
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
          </div>
        )}

        {loading ? (
          <section className="profile-card">
            <div className="profile-avatar">
              V
            </div>

            <div className="profile-main-info">
              <span>
                Verdict account
              </span>

              <h2>
                Loading profile...
              </h2>

              <p>
                Retrieving your
                account details.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="profile-card">
              <div className="profile-avatar">
                {avatarLetter}
              </div>

              <div className="profile-main-info">
                <span>
                  Verdict account
                </span>

                <h2>
                  {displayName}
                </h2>

                <p>
                  {displayEmail}
                </p>
              </div>

              <button
                type="button"
                className="profile-edit-button"
                onClick={
                  startEditing
                }
              >
                Edit
              </button>
            </section>

            {editing && (
              <section className="profile-section">
                <span className="section-label">
                  Edit profile
                </span>

                <form
                  className="profile-edit-form"
                  onSubmit={
                    saveProfile
                  }
                >
                  <label>
                    <span>
                      Full name
                    </span>

                    <input
                      type="text"
                      value={
                        draftProfile
                          .name
                      }
                      disabled={
                        saving
                      }
                      onChange={(
                        event
                      ) =>
                        updateDraft(
                          "name",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Enter your full name"
                    />
                  </label>

                  <label>
                    <span>
                      Email
                    </span>

                    <input
                      type="email"
                      value={
                        draftProfile
                          .email
                      }
                      disabled
                      readOnly
                    />

                    <small>
                      Your sign-in
                      email is managed
                      securely through
                      your account.
                    </small>
                  </label>

                  <label>
                    <span>
                      Phone number{" "}
                      <small>
                        (optional)
                      </small>
                    </span>

                    <input
                      type="tel"
                      value={
                        draftProfile
                          .phone
                      }
                      disabled={
                        saving
                      }
                      onChange={(
                        event
                      ) =>
                        updateDraft(
                          "phone",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Enter your phone number"
                    />
                  </label>

                  <div className="profile-edit-actions">
                    <button
                      type="button"
                      onClick={
                        cancelEditing
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
                        : "Save changes"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="profile-section">
              <span className="section-label">
                Personal
                information
              </span>

              <div className="profile-info-list">
                <button
                  type="button"
                  className="profile-row"
                  onClick={
                    startEditing
                  }
                >
                  <div>
                    <span>
                      Full name
                    </span>

                    <strong>
                      {displayName}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-row"
                  onClick={
                    startEditing
                  }
                >
                  <div>
                    <span>
                      Email
                    </span>

                    <strong>
                      {displayEmail}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-row"
                  onClick={
                    startEditing
                  }
                >
                  <div>
                    <span>
                      Phone number
                    </span>

                    <strong>
                      {profile.phone ||
                        "Not added"}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>
              </div>
            </section>

            <section className="profile-section">
              <span className="section-label">
                Preferences
              </span>

              <div className="profile-info-list">
                <button
                  type="button"
                  className="profile-row"
                  onClick={() =>
                    navigate(
                      "/settings"
                    )
                  }
                >
                  <div>
                    <span>
                      Language
                    </span>

                    <strong>
                      {profile
                        .preferredLanguage ||
                        "English"}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-row"
                  onClick={() =>
                    navigate(
                      "/settings"
                    )
                  }
                >
                  <div>
                    <span>
                      Location
                    </span>

                    <strong>
                      {profile
                        .location ||
                        "Not set"}
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className="profile-row"
                  onClick={() =>
                    navigate(
                      "/settings"
                    )
                  }
                >
                  <div>
                    <span>
                      Account
                      settings
                    </span>

                    <strong>
                      Security,
                      privacy and
                      preferences
                    </strong>
                  </div>

                  <span>
                    →
                  </span>
                </button>
              </div>
            </section>

            <section className="profile-section">
              <span className="section-label">
                Your Verdict
              </span>

              <div className="profile-stats">
                <article>
                  <strong>
                    {
                      activeMatterCount
                    }
                  </strong>

                  <span>
                    Active matters
                  </span>
                </article>

                <article>
                  <strong>
                    {
                      calendarItemCount
                    }
                  </strong>

                  <span>
                    Calendar items
                  </span>
                </article>

                <article>
                  <strong>
                    {
                      evidenceCount
                    }
                  </strong>

                  <span>
                    Evidence files
                  </span>
                </article>
              </div>
            </section>

            <article className="profile-notice">
              <span>
                i
              </span>

              <div>
                <strong>
                  Your Verdict
                  profile is synced
                  securely.
                </strong>

                <p>
                  Your account
                  details and Verdict
                  activity are now
                  connected to your
                  signed-in account
                  rather than stored
                  only on this device.
                </p>
              </div>
            </article>
          </>
        )}
      </section>
    </main>
  );
}

export default Profile;