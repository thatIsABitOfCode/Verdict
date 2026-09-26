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

import "../styles/terms.css";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

const SUMMARIES = [
  {
    icon: "⚖",
    title:
      "Legal information, not a lawyer",
    text:
      "Verdict helps you understand and organise legal matters, but it does not replace a qualified legal professional.",
  },
  {
    icon: "◎",
    title:
      "AI can make mistakes",
    text:
      "Important legal information, documents and deadlines should always be reviewed before you act.",
  },
  {
    icon: "✓",
    title:
      "No guaranteed outcomes",
    text:
      "Verdict cannot guarantee how a court, tribunal, organisation or professional will respond to your matter.",
  },
  {
    icon: "🔒",
    title:
      "Protect sensitive information",
    text:
      "Only upload information and evidence that you are legally entitled to possess and share.",
  },
  {
    icon: "◷",
    title:
      "You remain responsible for deadlines",
    text:
      "Verdict may provide reminders, but you remain responsible for confirming and meeting official deadlines.",
  },
  {
    icon: "→",
    title:
      "You remain in control",
    text:
      "Verdict may suggest next steps and referrals. You decide whether to act on them.",
  },
];

function Terms() {
  const navigate =
    useNavigate();

  const [
    accepted,
    setAccepted,
  ] = useState(false);

  const [
    checkingAcceptance,
    setCheckingAcceptance,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
    If this user already accepted the
    current version, don't ask again.
  */
  useEffect(() => {
    let mounted = true;

    async function checkExistingAcceptance() {
      try {
        const {
          data: {
            user,
          },
          error: userError,
        } =
          await supabase.auth
            .getUser();

        if (
          userError ||
          !user
        ) {
          if (mounted) {
            navigate(
              "/login",
              {
                replace: true,
              }
            );
          }

          return;
        }

        const {
          data: existingAcceptance,
          error: lookupError,
        } =
          await supabase
            .from(
              "legal_acceptances"
            )
            .select("id")
            .eq(
              "user_id",
              user.id
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

        if (lookupError) {
          throw lookupError;
        }

        if (
          existingAcceptance &&
          mounted
        ) {
          navigate(
            "/home",
            {
              replace: true,
            }
          );

          return;
        }
      } catch (checkError) {
        console.error(
          "Unable to check legal acceptance:",
          checkError
        );

        if (mounted) {
          setError(
            "Verdict couldn't check your previous acceptance. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setCheckingAcceptance(
            false
          );
        }
      }
    }

    checkExistingAcceptance();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function continueToVerdict() {
    if (
      !accepted ||
      loading
    ) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !user
      ) {
        setError(
          "Your session could not be verified. Please sign in again."
        );

        return;
      }

      /*
        Check again before inserting.

        This prevents duplicate
        acceptance records even if the
        button is somehow triggered twice.
      */
      const {
        data: existingAcceptance,
        error: lookupError,
      } =
        await supabase
          .from(
            "legal_acceptances"
          )
          .select("id")
          .eq(
            "user_id",
            user.id
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

      if (lookupError) {
        throw lookupError;
      }

      if (!existingAcceptance) {
        const now =
          new Date()
            .toISOString();

        const {
          error: acceptanceError,
        } =
          await supabase
            .from(
              "legal_acceptances"
            )
            .insert({
              user_id:
                user.id,
              terms_version:
                TERMS_VERSION,
              privacy_version:
                PRIVACY_VERSION,
              terms_accepted_at:
                now,
              privacy_accepted_at:
                now,
            });

        if (acceptanceError) {
          throw acceptanceError;
        }
      }

      navigate(
        "/home",
        {
          replace: true,
        }
      );
    } catch (acceptanceFailure) {
      console.error(
        "Unable to save legal acceptance:",
        acceptanceFailure
      );

      const message =
        acceptanceFailure
          ?.message
          ?.toLowerCase() ||
        "";

      if (
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
          "We couldn't save your acceptance. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function openFullTerms() {
    navigate(
      "/terms/full",
      {
        state: {
          from: "/terms",
        },
      }
    );
  }

  function openPrivacy() {
    navigate(
      "/privacy",
      {
        state: {
          from: "/terms",
        },
      }
    );
  }

  if (checkingAcceptance) {
    return (
      <main className="terms-page">
        <section className="terms-shell">
          <div className="terms-header">
            <span className="terms-brand">
              VERDICT
            </span>

            <p className="eyebrow">
              Checking your account
            </p>

            <h1>
              Please wait...
            </h1>

            <p className="terms-intro">
              We're checking whether
              you've already accepted
              the current terms.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="terms-page">
      <section className="terms-shell">
        <div className="terms-header">
          <span className="terms-brand">
            VERDICT
          </span>

          <p className="eyebrow">
            Before you continue
          </p>

          <h1>
            Use Verdict with
            confidence.
          </h1>

          <p className="terms-intro">
            Please understand these
            important points before
            using Verdict.
          </p>
        </div>

        <div className="terms-summary">
          {SUMMARIES.map(
            (item) => (
              <article
                className="terms-card"
                key={item.title}
              >
                <div className="terms-icon">
                  {item.icon}
                </div>

                <div>
                  <h2>
                    {item.title}
                  </h2>

                  <p>
                    {item.text}
                  </p>
                </div>
              </article>
            )
          )}
        </div>

        <div className="terms-links">
          <button
            type="button"
            onClick={
              openFullTerms
            }
            disabled={loading}
          >
            Read full Terms &
            Conditions →
          </button>

          <button
            type="button"
            onClick={
              openPrivacy
            }
            disabled={loading}
          >
            Read Privacy Policy →
          </button>
        </div>

        <label className="terms-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) =>
              setAccepted(
                event.target.checked
              )
            }
            disabled={loading}
          />

          <span>
            I have read and agree
            to Verdict's Terms &
            Conditions and Privacy
            Policy.
          </span>
        </label>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          className="accept-button"
          type="button"
          disabled={
            !accepted ||
            loading
          }
          onClick={
            continueToVerdict
          }
        >
          {loading
            ? "Saving..."
            : "Accept & Continue"}

          {!loading && (
            <span>→</span>
          )}
        </button>
      </section>
    </main>
  );
}

export default Terms;