import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/knowYourRights.css";

const DOMAIN_ICONS = {
  employment: "▣",
  family: "○",
  "domestic-violence": "!",
  harassment: "!",
  housing: "⌂",
  property: "⌂",
  consumer: "◇",
  "debt-credit": "R",
  banking: "R",
  insurance: "◇",
  contracts: "□",
  business: "□",
  criminal: "!",
  police: "!",
  "civil-claims": "□",
  "personal-injury": "+",
  "road-traffic": "◇",
  equality: "=",
  "human-rights": "=",
  education: "□",
  healthcare: "+",
  "social-support": "R",
  government: "□",
  municipal: "□",
  immigration: "◇",
  privacy: "◇",
  digital: "◇",
  defamation: "○",
  "intellectual-property": "◇",
  "wills-estates": "□",
  "customary-law": "○",
  environment: "⌂",
  tax: "R",
  courts: "□",
  documents: "□",
  other: "+",
};

function buildDomainData(
  domains,
  issueTypes,
  topics
) {
  const topicsByIssue =
    new Map();

  topics.forEach((topic) => {
    if (!topic.issue_type_id) {
      return;
    }

    const current =
      topicsByIssue.get(
        topic.issue_type_id
      ) || [];

    current.push(topic);

    topicsByIssue.set(
      topic.issue_type_id,
      current
    );
  });

  const issuesByDomain =
    new Map();

  issueTypes.forEach(
    (issue) => {
      const current =
        issuesByDomain.get(
          issue.domain_id
        ) || [];

      current.push({
        ...issue,
        topics:
          topicsByIssue.get(
            issue.id
          ) || [],
      });

      issuesByDomain.set(
        issue.domain_id,
        current
      );
    }
  );

  return domains.map(
    (domain) => ({
      ...domain,
      icon:
        DOMAIN_ICONS[
          domain.slug
        ] || "◇",
      issueTypes:
        issuesByDomain.get(
          domain.id
        ) || [],
    })
  );
}

function KnowYourRights() {
  const navigate =
    useNavigate();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    domains,
    setDomains,
  ] = useState([]);

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

    async function loadRightsData() {
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
          domainResult,
          issueResult,
          topicResult,
        ] =
          await Promise.all([
            supabase
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
                "status",
                "active"
              )
              .order(
                "sort_order",
                {
                  ascending:
                    true,
                }
              ),

            supabase
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
                "status",
                "active"
              )
              .order(
                "sort_order",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "legal_topics"
              )
              .select(
                `
                  id,
                  issue_type_id,
                  slug,
                  name,
                  summary,
                  status,
                  sort_order
                `
              )
              .eq(
                "status",
                "published"
              )
              .order(
                "sort_order",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (
          domainResult.error
        ) {
          throw domainResult.error;
        }

        if (
          issueResult.error
        ) {
          throw issueResult.error;
        }

        if (
          topicResult.error
        ) {
          throw topicResult.error;
        }

        if (!mounted) {
          return;
        }

        setDomains(
          buildDomainData(
            domainResult.data || [],
            issueResult.data || [],
            topicResult.data || []
          )
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load legal topics:",
          loadError
        );

        if (mounted) {
          setError(
            "We couldn't load legal information right now. Please try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRightsData();

    return () => {
      mounted = false;
    };
  }, [retryKey]);

  const filteredTopics =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return domains;
      }

      return domains.filter(
        (domain) => {
          const domainText =
            `${domain.name} ${domain.description || ""}`
              .toLowerCase();

          if (
            domainText.includes(
              query
            )
          ) {
            return true;
          }

          return domain.issueTypes.some(
            (issue) => {
              const issueText =
                `${issue.name} ${issue.description || ""}`
                  .toLowerCase();

              if (
                issueText.includes(
                  query
                )
              ) {
                return true;
              }

              return issue.topics.some(
                (topic) =>
                  `${topic.name} ${topic.summary || ""}`
                    .toLowerCase()
                    .includes(
                      query
                    )
              );
            }
          );
        }
      );
    }, [
      domains,
      search,
    ]);

  function openTopic(
    domain
  ) {
    navigate(
      `/rights/${domain.slug}`,
      {
        state: {
          domain,
        },
      }
    );
  }

  return (
    <main className="rights-page">
      <section className="rights-shell">
        <header className="rights-header">
          <button
            type="button"
            className="rights-back"
            onClick={() =>
              navigate("/home")
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="rights-wordmark">
            VERDICT
          </span>

          <div className="rights-header-space" />
        </header>

        <section className="rights-title">
          <span className="rights-eyebrow">
            Legal information
          </span>

          <h1>
            Know Your Rights
          </h1>

          <p>
            Choose what you're
            dealing with. Verdict
            will help you find
            relevant legal
            information in plain
            language.
          </p>
        </section>

        <div className="rights-search">
          <span>
            ⌕
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="What do you need help with?"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <section className="rights-section">
          <div className="rights-section-heading">
            <span className="section-label">
              Browse by topic
            </span>

            <p>
              Start with the
              situation, not the
              legal terminology.
            </p>
          </div>

          {loading ? (
            <div className="rights-no-results">
              <h2>
                Loading legal
                topics...
              </h2>

              <p>
                Verdict is loading
                the current legal
                information
                catalogue.
              </p>
            </div>
          ) : error ? (
            <div
              className="rights-no-results"
              role="alert"
            >
              <h2>
                Unable to load
                topics
              </h2>

              <p>
                {error}
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
                Try again →
              </button>
            </div>
          ) : filteredTopics.length >
            0 ? (
            <div className="rights-topic-list">
              {filteredTopics.map(
                (domain) => (
                  <button
                    type="button"
                    className="rights-topic-card"
                    key={
                      domain.id
                    }
                    onClick={() =>
                      openTopic(
                        domain
                      )
                    }
                  >
                    <div className="rights-topic-icon">
                      {
                        domain.icon
                      }
                    </div>

                    <div className="rights-topic-copy">
                      <h2>
                        {
                          domain.name
                        }
                      </h2>

                      <p>
                        {domain.description ||
                          "Browse legal issues in this area."}
                      </p>
                    </div>

                    <span className="rights-topic-arrow">
                      →
                    </span>
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="rights-no-results">
              <h2>
                No matching topic
              </h2>

              <p>
                You don't need to
                know the legal
                category. Tell
                Verdict what
                happened instead.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/matters/new"
                  )
                }
              >
                Tell us what
                happened →
              </button>
            </div>
          )}
        </section>

        <section className="rights-unsure-card">
          <div className="rights-unsure-mark">
            V
          </div>

          <div>
            <span>
              Not sure where to
              start?
            </span>

            <h2>
              Describe what
              happened.
            </h2>

            <p>
              You don't need to
              identify the law or
              choose the correct
              legal category
              yourself.
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

        <div className="rights-disclaimer">
          <strong>
            Legal information,
            not legal advice.
          </strong>

          <p>
            Verdict helps make
            legal information
            easier to understand.
            It does not replace
            advice from a
            qualified legal
            professional.
          </p>
        </div>
      </section>
    </main>
  );
}

export default KnowYourRights;
