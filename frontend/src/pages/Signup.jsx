import { useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";

function Signup() {
  const navigate = useNavigate();

  const [fullName, setFullName] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanName =
      fullName.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !cleanName ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      setError(
        "Please complete all fields."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Your passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error: signupError,
      } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
          },
        });

      if (signupError) {
        throw signupError;
      }

      if (!data.user) {
        throw new Error(
          "Verdict could not create your account."
        );
      }

      /*
        Keep a lightweight local copy
        for the current frontend UI.

        Passwords are NEVER stored here.
      */
      try {
        const savedProfile =
          localStorage.getItem(
            "verdict-profile"
          );

        const existingProfile =
          savedProfile
            ? JSON.parse(
                savedProfile
              )
            : {};

        localStorage.setItem(
          "verdict-profile",
          JSON.stringify({
            ...existingProfile,
            name: cleanName,
            email: cleanEmail,
          })
        );
      } catch (storageError) {
        console.error(
          "Unable to save local profile:",
          storageError
        );
      }

      /*
        If Supabase created a session,
        the user is already authenticated.

        We can therefore create/update
        their protected profile row.
      */
      if (data.session) {
        const {
          error: profileError,
        } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name: cleanName,
            email: cleanEmail,
          });

        if (profileError) {
          console.error(
            "Unable to save profile:",
            profileError
          );
        }

        navigate("/terms");
        return;
      }

      /*
        If there is no session,
        email confirmation is enabled.
      */
      setSuccess(
        "Your account was created. Check your email and confirm your address before signing in."
      );

      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (submitError) {
      console.error(
        "Signup failed:",
        submitError
      );

      const message =
        submitError?.message
          ?.toLowerCase() || "";

      if (
        message.includes(
          "already registered"
        ) ||
        message.includes(
          "already exists"
        )
      ) {
        setError(
          "An account with this email already exists. Try signing in instead."
        );
      } else if (
        message.includes(
          "password"
        )
      ) {
        setError(
          "That password does not meet the account security requirements."
        );
      } else if (
        message.includes(
          "network"
        ) ||
        message.includes(
          "fetch"
        )
      ) {
        setError(
          "Verdict could not connect right now. Check your internet connection and try again."
        );
      } else {
        setError(
          submitError?.message ||
            "We couldn't create your account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-brand">
          <div className="mini-logo">
            V
          </div>

          <span>VERDICT</span>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">
            Create your account
          </p>

          <h1>
            Start with Verdict
          </h1>

          <p>
            Keep your legal matters,
            evidence and important dates
            in one place.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            Full name

            <input
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
              placeholder="Your full name"
              autoComplete="name"
              disabled={loading}
              required
            />
          </label>

          <label>
            Email address

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </label>

          <label>
            Password

            <div className="password-input-wrap">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Create a password"
                autoComplete="new-password"
                minLength="8"
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                disabled={loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={
                  showPassword
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>

            <small className="auth-field-hint">
              At least 8 characters
            </small>
          </label>

          <label>
            Confirm password

            <div className="password-input-wrap">
              <input
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Confirm your password"
                autoComplete="new-password"
                minLength="8"
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) =>
                      !current
                  )
                }
                disabled={loading}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmed password"
                    : "Show confirmed password"
                }
                aria-pressed={
                  showConfirmPassword
                }
              >
                {showConfirmPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <div
              className="auth-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="auth-prototype-notice"
              role="status"
            >
              <span>✓</span>

              <p>
                {success}
              </p>
            </div>
          )}

          <button
            className="primary-auth-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Continue"}

            {!loading && (
              <span>→</span>
            )}
          </button>
        </form>

        <article className="auth-prototype-notice">
          <span>✓</span>

          <p>
            Your account is protected
            using secure Supabase
            authentication. Verdict
            never stores your password
            in local storage.
          </p>
        </article>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default Signup;