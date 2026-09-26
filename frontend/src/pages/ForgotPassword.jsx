import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";

import "../styles/forgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    const trimmedEmail =
      email.trim();

    if (!trimmedEmail) {
      setError(
        "Enter your email address."
      );

      return;
    }

    if (
      !trimmedEmail.includes("@")
    ) {
      setError(
        "Enter a valid email address."
      );

      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const {
        error: resetError,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            trimmedEmail,
            {
              redirectTo,
            }
          );

      if (resetError) {
        throw resetError;
      }

      setSubmitted(true);
    } catch (
      resetError
    ) {
      console.error(
        "Unable to request password reset:",
        resetError
      );

      if (
        resetError?.message
          ?.toLowerCase()
          .includes(
            "rate limit"
          )
      ) {
        setError(
          "Too many reset requests. Please wait a little while and try again."
        );
      } else {
        setError(
          "We couldn't send the reset email right now. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setEmail("");
    setError("");
  }

  return (
    <main className="forgot-page">
      <section className="forgot-shell">
        <header className="forgot-header">
          <button
            type="button"
            className="forgot-back"
            onClick={() =>
              navigate("/login")
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

        {!submitted ? (
          <>
            <section className="forgot-title">
              <span className="forgot-eyebrow">
                Account recovery
              </span>

              <h1>
                Forgot your
                password?
              </h1>

              <p>
                Enter the email
                connected to your
                Verdict account.
                We'll send you a
                secure link to
                create a new
                password.
              </p>
            </section>

            <form
              className="forgot-form"
              onSubmit={
                handleSubmit
              }
            >
              <label htmlFor="forgot-email">
                Email address
              </label>

              <input
                id="forgot-email"
                type="email"
                value={email}
                disabled={loading}
                onChange={(
                  event
                ) => {
                  setEmail(
                    event.target
                      .value
                  );

                  setError("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
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
                disabled={loading}
              >
                {loading
                  ? "Sending..."
                  : "Send reset link"}

                {!loading && (
                  <span>
                    →
                  </span>
                )}
              </button>
            </form>

            <button
              type="button"
              className="forgot-login-link"
              onClick={() =>
                navigate(
                  "/login"
                )
              }
              disabled={loading}
            >
              Remembered your
              password?
              <span>
                {" "}
                Back to login
              </span>
            </button>

            <article className="forgot-security">
              <span>
                i
              </span>

              <div>
                <strong>
                  Secure account
                  recovery
                </strong>

                <p>
                  Password reset
                  links are sent
                  through Verdict's
                  authentication
                  service. Verdict
                  will never ask you
                  to send your
                  password by email
                  or message.
                </p>
              </div>
            </article>
          </>
        ) : (
          <section className="forgot-success">
            <div className="forgot-success-icon">
              ✓
            </div>

            <span className="forgot-eyebrow">
              Check your email
            </span>

            <h1>
              Reset link
              requested.
            </h1>

            <p>
              If a Verdict account
              exists for
            </p>

            <strong>
              {email.trim()}
            </strong>

            <p className="forgot-success-note">
              you'll receive an
              email containing a
              secure password-reset
              link. Check your spam
              or junk folder if you
              don't see it.
            </p>

            <button
              type="button"
              className="forgot-primary"
              onClick={() =>
                navigate(
                  "/login"
                )
              }
            >
              Back to login
              <span>
                →
              </span>
            </button>

            <button
              type="button"
              className="forgot-secondary"
              onClick={
                resetForm
              }
            >
              Use a different email
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

export default ForgotPassword;