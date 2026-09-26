import {
  Link,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";

import { supabase } from "../lib/supabaseClient";

import "../styles/auth.css";
import verdictLogo from "../assets/verdict-logo.png";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

function getRememberedEmail() {
  try {
    return (
      localStorage.getItem(
        "verdict-remembered-email"
      ) || ""
    );
  } catch {
    return "";
  }
}

function Login() {
  const navigate = useNavigate();

  const rememberedEmail =
    getRememberedEmail();

  const [email, setEmail] =
    useState(rememberedEmail);

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(
      Boolean(rememberedEmail)
    );

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !cleanEmail ||
      !password
    ) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    setLoading(true);

    try {
      /*
        Authenticate with Supabase.
      */
      const {
        data,
        error: signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email: cleanEmail,
            password,
          });

      if (signInError) {
        throw signInError;
      }

      if (
        !data.user ||
        !data.session
      ) {
        throw new Error(
          "Verdict could not sign you in."
        );
      }

      /*
        Remember only the email.
        Passwords are never stored locally.
      */
      try {
        if (rememberMe) {
          localStorage.setItem(
            "verdict-remembered-email",
            cleanEmail
          );
        } else {
          localStorage.removeItem(
            "verdict-remembered-email"
          );
        }
      } catch (storageError) {
        console.error(
          "Unable to save remembered email:",
          storageError
        );
      }

      /*
        Load the user's profile.
      */
      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select(
            "full_name, email, phone, preferred_language, location"
          )
          .eq(
            "id",
            data.user.id
          )
          .maybeSingle();

      if (profileError) {
        console.error(
          "Unable to load profile:",
          profileError
        );
      }

      /*
        Keep the existing local frontend
        profile cache.
      */
      try {
        localStorage.setItem(
          "verdict-profile",
          JSON.stringify({
            name:
              profile?.full_name ||
              data.user
                .user_metadata
                ?.full_name ||
              "",
            email:
              profile?.email ||
              data.user.email ||
              cleanEmail,
            phone:
              profile?.phone ||
              "",
          })
        );
      } catch (storageError) {
        console.error(
          "Unable to cache profile locally:",
          storageError
        );
      }

      setPassword("");
      setShowPassword(false);

      /*
        Check whether this account has
        accepted the current Terms and
        Privacy Policy.
      */
      const {
        data: legalAcceptance,
        error: acceptanceError,
      } =
        await supabase
          .from("legal_acceptances")
          .select("id")
          .eq(
            "user_id",
            data.user.id
          )
          .eq(
            "terms_version",
            TERMS_VERSION
          )
          .eq(
            "privacy_version",
            PRIVACY_VERSION
          )
          .maybeSingle();

      if (acceptanceError) {
        throw acceptanceError;
      }

      /*
        Check whether this authenticated
        account has Verdict admin access.

        Admin access is determined by the
        authenticated user's UUID, not by
        their email address.
      */
      const {
        data: adminAccess,
        error: adminAccessError,
      } =
        await supabase
          .from("support_admins")
          .select("user_id")
          .eq(
            "user_id",
            data.user.id
          )
          .maybeSingle();

      if (adminAccessError) {
        throw adminAccessError;
      }

      const isAdmin =
        Boolean(adminAccess);

      /*
        Everyone must accept the current
        Terms and Privacy Policy first.

        Once accepted:
        - administrators enter Verdict Admin
        - normal users enter the user app
      */
      if (!legalAcceptance) {
        navigate(
          "/terms",
          {
            replace: true,
          }
        );

        return;
      }

      navigate(
        isAdmin
          ? "/admin"
          : "/home",
        {
          replace: true,
        }
      );
    } catch (signInFailure) {
      console.error(
        "Login failed:",
        signInFailure
      );

      const message =
        signInFailure?.message
          ?.toLowerCase() || "";

      if (
        message.includes(
          "invalid login credentials"
        )
      ) {
        setError(
          "The email or password is incorrect."
        );
      } else if (
        message.includes(
          "email not confirmed"
        )
      ) {
        setError(
          "Please confirm your email address before signing in."
        );
      } else if (
        message.includes("network") ||
        message.includes("fetch")
      ) {
        setError(
          "Verdict could not connect right now. Check your internet connection and try again."
        );
      } else {
        setError(
          signInFailure?.message ||
            "We couldn't sign you in. Please try again."
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
  <img
    src={verdictLogo}
    alt="Verdict"
    className="auth-brand-logo"
  />
</div>

        <div className="auth-copy">
          <p className="eyebrow">
            Welcome back
          </p>

          <h1>
            Sign in to Verdict
          </h1>

          <p>
            Access your matters,
            evidence, deadlines and
            legal guidance.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
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
                placeholder="Enter your password"
                autoComplete="current-password"
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
          </label>

          <div className="auth-row">
            <label className="remember-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(
                    event.target.checked
                  )
                }
                disabled={loading}
              />

              <span>
                Remember email
              </span>
            </label>

            <button
              className="text-button"
              type="button"
              onClick={() =>
                navigate(
                  "/forgot-password"
                )
              }
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div
              className="auth-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="primary-auth-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Continue"}

            {!loading && (
              <span>→</span>
            )}
          </button>
        </form>

        <article className="auth-prototype-notice">
          <span>✓</span>

          <p>
            Sign-in is protected using
            secure Supabase
            authentication. Verdict
            never stores your password
            in local storage.
          </p>
        </article>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/signup">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}

export default Login;