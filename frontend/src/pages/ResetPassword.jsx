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

import "../styles/forgotPassword.css";

function ResetPassword() {
  const navigate =
    useNavigate();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    sessionReady,
    setSessionReady,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    success,
    setSuccess,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      try {
        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (
          mounted &&
          session
        ) {
          setSessionReady(
            true
          );
        }
      } catch (
        sessionError
      ) {
        console.error(
          "Unable to verify recovery session:",
          sessionError
        );
      }
    }

    checkRecoverySession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (
              event ===
                "PASSWORD_RECOVERY" ||
              session
            ) {
              setSessionReady(
                true
              );
            }
          }
        );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!password) {
      setError(
        "Enter a new password."
      );
      return;
    }

    if (
      password.length < 8
    ) {
      setError(
        "Your password must be at least 8 characters long."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "The passwords do not match."
      );
      return;
    }

    if (!sessionReady) {
      setError(
        "This password-reset link is invalid or has expired. Request a new one."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        error:
          updateError,
      } =
        await supabase.auth
          .updateUser({
            password,
          });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
    } catch (
      updateError
    ) {
      console.error(
        "Unable to update password:",
        updateError
      );

      const message =
        updateError
          ?.message
          ?.toLowerCase() ||
        "";

      if (
        message.includes(
          "expired"
        ) ||
        message.includes(
          "invalid"
        )
      ) {
        setError(
          "This password-reset link is invalid or has expired. Request a new one."
        );
      } else {
        setError(
          "We couldn't update your password. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="forgot-page">
        <section className="forgot-shell">
          <header className="forgot-header">
            <div className="forgot-header-space" />

            <span className="forgot-wordmark">
              VERDICT
            </span>

            <div className="forgot-header-space" />
          </header>

          <section className="forgot-success">
            <div className="forgot-success-icon">
              ✓
            </div>

            <span className="forgot-eyebrow">
              Password updated
            </span>

            <h1>
              Your password has
              been changed.
            </h1>

            <p>
              You can now sign in
              to Verdict using
              your new password.
            </p>

            <button
              type="button"
              className="forgot-primary"
              onClick={() =>
                navigate(
                  "/login",
                  {
                    replace: true,
                  }
                )
              }
            >
              Go to login
              <span>
                →
              </span>
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="forgot-page">
      <section className="forgot-shell">
        <header className="forgot-header">
          <button
            type="button"
            className="forgot-back"
            onClick={() =>
              navigate(
                "/login"
              )
            }
            aria-label="Go back to login"
          >
            ←
          </button>

          <span className="forgot-wordmark">
            VERDICT
          </span>

          <div className="forgot-header-space" />
        </header>

        <section className="forgot-title">
          <span className="forgot-eyebrow">
            Secure recovery
          </span>

          <h1>
            Create a new
            password.
          </h1>

          <p>
            Choose a new password
            for your Verdict
            account.
          </p>
        </section>

        {!sessionReady && (
          <article className="forgot-security">
            <span>
              i
            </span>

            <div>
              <strong>
                Verifying your
                reset link
              </strong>

              <p>
                Verdict is checking
                that this password
                recovery session
                is valid.
              </p>
            </div>
          </article>
        )}

        <form
          className="forgot-form"
          onSubmit={
            handleSubmit
          }
        >
          <label htmlFor="reset-password">
            New password
          </label>

          <input
            id="reset-password"
            type="password"
            value={password}
            disabled={
              loading
            }
            onChange={(
              event
            ) => {
              setPassword(
                event.target
                  .value
              );

              setError("");
            }}
            placeholder="Enter a new password"
            autoComplete="new-password"
          />

          <label htmlFor="reset-confirm-password">
            Confirm new password
          </label>

          <input
            id="reset-confirm-password"
            type="password"
            value={
              confirmPassword
            }
            disabled={
              loading
            }
            onChange={(
              event
            ) => {
              setConfirmPassword(
                event.target
                  .value
              );

              setError("");
            }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />

          {error && (
            <p
              className="forgot-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="forgot-primary"
            disabled={
              loading ||
              !sessionReady
            }
          >
            {loading
              ? "Updating..."
              : "Update password"}

            {!loading && (
              <span>
                →
              </span>
            )}
          </button>
        </form>

        <article className="forgot-security">
          <span>
            i
          </span>

          <div>
            <strong>
              Keep your account
              secure
            </strong>

            <p>
              Use a password you
              do not reuse on
              other services.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default ResetPassword;