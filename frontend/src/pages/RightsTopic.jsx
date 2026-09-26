import {
  useEffect,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/rightsTopic.css";

const LEGACY_DOMAIN_ALIASES = {
  work: "employment",
  money: "debt-credit",
  safety: "domestic-violence",
};

function RightsTopic() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    topicId,
  } = useParams();

  const domainSlug =
    LEGACY_DOMAIN_ALIASES[
      topicId
    ] || topicId;

  const routeDomain =
    location.state?.domain;

  const [
    domain,
    setDomain,
  ] = useState(
    routeDomain?.slug ===
      domainSlug
      ? routeDomain
      : null
  );

  const [
    issueTypes,
    setIssueTypes,
  ] = useState([]);

  const [
    publishedIssueIds,
    setPublishedIssueIds,
  ] = useState(
    new Set()
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    retryKey,
    setRetryKey,
  ] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDomain() {
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
            domainData,
          error:
            domainError,
        } =
          await supabase
            .from(
              "legal_domains"
            )
            .select(
              `
                id,
                slug,
                name,
                description,
                sort_order
              `
            )
            .eq(
              "slug",
              domainSlug
            )
            .eq(
              "status",
              "active"
            )
            .maybeSingle();

        if (domainError) {
          throw domainError;
        }

        if (!domainData) {
          throw new Error(
            "This legal area could not be found."
          );
        }

        const {
          data:
            issueData,
          error:
            issueError,
        } =
          await supabase
            .from(
              "legal_issue_types"
            )
            .select(
              `
                id,
                domain_id,
                slug,
                name,
                description,
                sort_order
              `
            )
            .eq(
              "domain_id",
              domainData.id
            )
            .eq(
              "status",
              "active"
            )
            .order(
              "sort_order",
              {
                ascending:
                  true,
              }
            );

        if (issueError) {
          throw issueError;
        }

        const issueIds =
          (issueData || [])
            .map(
              (issue) =>
                issue.id
            );

        let publishedIds =
          new Set();

        if (
          issueIds.length > 0
        ) {
          const {
            data:
              topicData,
            error:
              topicError,
          } =
            await supabase
              .from(
                "legal_topics"
              )
              .select(
                "issue_type_id"
              )
              .in(
                "issue_type_id",
                issueIds
              )
              .eq(
                "status",
                "published"
              );

          if (topicError) {
            throw topicError;
          }

          publishedIds =
            new Set(
              (topicData || [])
                .map(
                  (topic) =>
                    topic.issue_type_id
                )
                .filter(Boolean)
            );
        }

        if (!mounted) {
          return;
        }

        setDomain(
          domainData
        );

        setIssueTypes(
          issueData || []
        );

        setPublishedIssueIds(
          publishedIds
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load rights topic:",
          loadError
        );

        if (mounted) {
          setError(
            loadError.message ||
              "We couldn't load this legal area right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDomain();

    return () => {
      mounted = false;
    };
  }, [
    domainSlug,
    retryKey,
  ]);

  function openIssue(
    issue
  ) {
    navigate(
      `/rights/${domain.slug}/${issue.slug}`,
      {
        state: {
          domain,
          issue,
        },
      }
    );
  }

  if (loading) {
    return (
      <main className="rights-topic-page">
        <section className="rights-topic-shell">
          <header className="rights-topic-header">
            <button
              type="button"
              className="rights-topic-back"
              onClick={() =>
                navigate(
                  "/rights"
                )
              }
              aria-label="Go back"
            >
              ←
            </button>

            <span className="rights-topic-wordmark">
              VERDICT
            </span>

            <div className="rights-topic-header-space" />
          </header>

          <section className="rights-topic-title">
            <span className="rights-topic-eyebrow">
              Know your rights
            </span>

            <h1>
              Loading legal
              topics...
            </h1>

            <p>
              Verdict is loading
              the issues in this
              legal area.
            </p>
          </section>
        </section>
      </main>
    );
  }

  if (error || !domain) {
    return (
      <main className="rights-topic-page">
        <section className="rights-topic-shell">
          <header className="rights-topic-header">
            <button
              type="button"
              className="rights-topic-back"
              onClick={() =>
                navigate(
                  "/rights"
                )
              }
              aria-label="Go back"
            >
              ←
            </button>

            <span className="rights-topic-wordmark">
              VERDICT
            </span>

            <div className="rights-topic-header-space" />
          </header>

          <section className="rights-topic-title">
            <span className="rights-topic-eyebrow">
              Know your rights
            </span>

            <h1>
              Information
              unavailable
            </h1>

            <p>
              {error ||
                "This legal area could not be found."}
            </p>

            <button
              type="button"
              onClick={() =>
                setRetryKey(
                  (current) =>
                    current + 1
                )
              }
            >
              Try again
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="rights-topic-page">
      <section className="rights-topic-shell">
        <header className="rights-topic-header">
          <button
            type="button"
            className="rights-topic-back"
            onClick={() =>
              navigate(
                "/rights"
              )
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="rights-topic-wordmark">
            VERDICT
          </span>

          <div className="rights-topic-header-space" />
        </header>

        <section className="rights-topic-title">
          <span className="rights-topic-eyebrow">
            Know your rights
          </span>

          <h1>
            {domain.name}
          </h1>

          <p>
            {domain.description}
          </p>
        </section>

        <article className="rights-topic-status">
          <div className="rights-topic-status-mark">
            V
          </div>

          <div>
            <span>
              Choose your situation
            </span>

            <h2>
              Start with what happened
            </h2>

            <p>
              You do not need to know
              the law or identify the
              correct legal rule
              yourself. Choose the
              situation that sounds
              closest to your problem.
            </p>
          </div>
        </article>

        <section className="rights-topic-section">
          <span className="section-label">
            Common situations
          </span>

          <div className="rights-topic-blocks">
            {issueTypes.length >
            0 ? (
              issueTypes.map(
                (
                  issue,
                  index
                ) => (
                  <button
                    type="button"
                    className="rights-topic-block"
                    key={
                      issue.id
                    }
                    onClick={() =>
                      openIssue(
                        issue
                      )
                    }
                  >
                    <div className="rights-topic-number">
                      {index +
                        1}
                    </div>

                    <div>
                      <h2>
                        {
                          issue.name
                        }
                      </h2>

                      <p>
                        {issue.description ||
                          "Open this issue to see the legal information Verdict currently has available."}
                      </p>

                      <div className="rights-source-placeholder">
                        <span className="rights-source-dot" />

                        <div>
                          <strong>
                            {publishedIssueIds.has(
                              issue.id
                            )
                              ? "Verified guidance available"
                              : "Legal area recognised"}
                          </strong>

                          <span>
                            {publishedIssueIds.has(
                              issue.id
                            )
                              ? "Open source-backed legal information"
                              : "Open to see what Verdict can currently help with"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              )
            ) : (
              <article className="rights-topic-block">
                <div className="rights-topic-number">
                  1
                </div>

                <div>
                  <h2>
                    Describe what
                    happened
                  </h2>

                  <p>
                    You do not
                    need to know
                    the legal
                    category
                    yourself.
                  </p>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="rights-topic-action-card">
          <div>
            <span>
              Not sure which one
              fits?
            </span>

            <h2>
              Tell Verdict what
              happened.
            </h2>

            <p>
              Starting a matter
              will let Verdict
              organise your
              facts, evidence and
              timeline without
              requiring you to
              identify the legal
              category yourself.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/matters/new"
                )
              }
            >
              Start a matter
              <span>
                →
              </span>
            </button>
          </div>
        </section>

        <div className="rights-topic-disclaimer">
          <strong>
            Legal information,
            not legal advice.
          </strong>

          <p>
            Verdict does not
            replace advice from a
            qualified legal
            professional and does
            not guarantee legal
            outcomes.
          </p>
        </div>
      </section>
    </main>
  );
}

export default RightsTopic;
