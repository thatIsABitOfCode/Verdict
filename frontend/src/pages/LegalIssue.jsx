import {
  useEffect,
  useMemo,
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

function formatVerifiedDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function LegalIssue() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    domainSlug,
    issueSlug,
  } = useParams();

  const [
    domain,
    setDomain,
  ] = useState(
    location.state?.domain ||
      null
  );

  const [
    issue,
    setIssue,
  ] = useState(
    location.state?.issue ||
      null
  );

  const [
    legalTopic,
    setLegalTopic,
  ] = useState(null);

  const [
    legalRules,
    setLegalRules,
  ] = useState([]);

  const [
    sources,
    setSources,
  ] = useState([]);

  const [
    referralRoutes,
    setReferralRoutes,
  ] = useState([]);

  const [
    organisations,
    setOrganisations,
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

    async function loadIssue() {
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
                description
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
                description
              `
            )
            .eq(
              "domain_id",
              domainData.id
            )
            .eq(
              "slug",
              issueSlug
            )
            .eq(
              "status",
              "active"
            )
            .maybeSingle();

        if (issueError) {
          throw issueError;
        }

        if (!issueData) {
          throw new Error(
            "This legal issue could not be found."
          );
        }

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
              `
                id,
                issue_type_id,
                slug,
                name,
                category,
                summary,
                status,
                sort_order
              `
            )
            .eq(
              "issue_type_id",
              issueData.id
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
            )
            .limit(1)
            .maybeSingle();

        if (topicError) {
          throw topicError;
        }

        let ruleData = [];
        let sourceData = [];
        let routeData = [];
        let organisationData = [];

        if (topicData) {
          const [
            rulesResult,
            topicSourcesResult,
            routesResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "legal_rules"
                )
                .select(
                  `
                    id,
                    topic_id,
                    source_id,
                    rule_type,
                    title,
                    plain_language_text,
                    section_reference,
                    citation_label,
                    verification_status,
                    last_verified_at,
                    sort_order
                  `
                )
                .eq(
                  "topic_id",
                  topicData.id
                )
                .eq(
                  "verification_status",
                  "verified"
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
                  "legal_topic_sources"
                )
                .select(
                  `
                    topic_id,
                    source_id,
                    is_primary,
                    relevance_note
                  `
                )
                .eq(
                  "topic_id",
                  topicData.id
                ),

              supabase
                .from(
                  "referral_routes"
                )
                .select(
                  `
                    id,
                    topic_id,
                    organisation_id,
                    route_type,
                    title,
                    instructions,
                    eligibility_notes,
                    urgency_note,
                    official_url,
                    status,
                    sort_order
                  `
                )
                .eq(
                  "topic_id",
                  topicData.id
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
            ]);

          if (
            rulesResult.error
          ) {
            throw rulesResult.error;
          }

          if (
            topicSourcesResult.error
          ) {
            throw topicSourcesResult.error;
          }

          if (
            routesResult.error
          ) {
            throw routesResult.error;
          }

          ruleData =
            rulesResult.data || [];

          routeData =
            routesResult.data || [];

          const sourceIds =
            Array.from(
              new Set([
                ...ruleData.map(
                  (rule) =>
                    rule.source_id
                ),
                ...(
                  topicSourcesResult.data ||
                  []
                ).map(
                  (link) =>
                    link.source_id
                ),
              ])
            ).filter(Boolean);

          if (
            sourceIds.length > 0
          ) {
            const {
              data,
              error:
                sourceError,
            } =
              await supabase
                .from(
                  "legal_sources"
                )
                .select(
                  `
                    id,
                    title,
                    source_type,
                    authority,
                    official_url,
                    jurisdiction,
                    status,
                    version_note,
                    is_verified,
                    last_verified_at
                  `
                )
                .in(
                  "id",
                  sourceIds
                )
                .eq(
                  "is_verified",
                  true
                );

            if (sourceError) {
              throw sourceError;
            }

            sourceData =
              data || [];
          }

          const organisationIds =
            Array.from(
              new Set(
                routeData.map(
                  (route) =>
                    route.organisation_id
                )
              )
            ).filter(Boolean);

          if (
            organisationIds.length >
            0
          ) {
            const {
              data,
              error:
                organisationError,
            } =
              await supabase
                .from(
                  "referral_organisations"
                )
                .select(
                  `
                    id,
                    name,
                    organisation_type,
                    description,
                    website_url,
                    phone,
                    email,
                    coverage_area,
                    province,
                    services,
                    eligibility_notes,
                    status,
                    is_verified,
                    last_verified_at
                  `
                )
                .in(
                  "id",
                  organisationIds
                )
                .eq(
                  "status",
                  "active"
                )
                .eq(
                  "is_verified",
                  true
                );

            if (
              organisationError
            ) {
              throw organisationError;
            }

            organisationData =
              data || [];
          }
        }

        if (!mounted) {
          return;
        }

        setDomain(
          domainData
        );

        setIssue(
          issueData
        );

        setLegalTopic(
          topicData
        );

        setLegalRules(
          ruleData
        );

        setSources(
          sourceData
        );

        setReferralRoutes(
          routeData
        );

        setOrganisations(
          organisationData
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load legal issue:",
          loadError
        );

        if (mounted) {
          setError(
            loadError.message ||
              "We couldn't load this legal issue right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadIssue();

    return () => {
      mounted = false;
    };
  }, [
    domainSlug,
    issueSlug,
    retryKey,
  ]);

  const sourceById =
    useMemo(
      () =>
        new Map(
          sources.map(
            (source) => [
              source.id,
              source,
            ]
          )
        ),
      [sources]
    );

  const organisationById =
    useMemo(
      () =>
        new Map(
          organisations.map(
            (
              organisation
            ) => [
              organisation.id,
              organisation,
            ]
          )
        ),
      [organisations]
    );

  const lastVerified =
    useMemo(() => {
      const values = [
        ...sources.map(
          (source) =>
            source.last_verified_at
        ),
        ...legalRules.map(
          (rule) =>
            rule.last_verified_at
        ),
        ...organisations.map(
          (
            organisation
          ) =>
            organisation.last_verified_at
        ),
      ]
        .filter(Boolean)
        .map(
          (value) =>
            new Date(
              value
            ).getTime()
        )
        .filter(
          (value) =>
            !Number.isNaN(
              value
            )
        );

      if (
        values.length === 0
      ) {
        return "";
      }

      return formatVerifiedDate(
        Math.max(
          ...values
        )
      );
    }, [
      sources,
      legalRules,
      organisations,
    ]);

  const hasVerifiedGuidance =
    Boolean(legalTopic) &&
    legalRules.length > 0;

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
                  `/rights/${domainSlug}`
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
              information...
            </h1>

            <p>
              Verdict is checking
              the verified legal
              information
              available for this
              issue.
            </p>
          </section>
        </section>
      </main>
    );
  }

  if (
    error ||
    !domain ||
    !issue
  ) {
    return (
      <main className="rights-topic-page">
        <section className="rights-topic-shell">
          <header className="rights-topic-header">
            <button
              type="button"
              className="rights-topic-back"
              onClick={() =>
                navigate(
                  `/rights/${domainSlug}`
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
                "This legal issue could not be found."}
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
                `/rights/${domain.slug}`
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
            {domain.name}
          </span>

          <h1>
            {legalTopic?.name ||
              issue.name}
          </h1>

          <p>
            {legalTopic?.summary ||
              issue.description ||
              "Legal information for this issue."}
          </p>
        </section>

        <article className="rights-topic-status">
          <div className="rights-topic-status-mark">
            V
          </div>

          <div>
            <span>
              {hasVerifiedGuidance
                ? "Verified legal information"
                : "Legal issue recognised"}
            </span>

            <h2>
              {hasVerifiedGuidance
                ? "Source-backed guidance is available"
                : "Detailed verified guidance is still being added"}
            </h2>

            <p>
              {hasVerifiedGuidance
                ? `Verdict is showing only published legal rules connected to verified sources.${
                    lastVerified
                      ? ` This material was last checked on ${lastVerified}.`
                      : ""
                  }`
                : "Verdict recognises this issue, but it will not fill gaps with guessed legal rules. You can still organise your matter, preserve evidence and build your timeline."}
            </p>
          </div>
        </article>

        {hasVerifiedGuidance ? (
          <>
            <section className="rights-topic-section">
              <span className="section-label">
                What the law says
              </span>

              <div className="rights-topic-blocks">
                {legalRules.map(
                  (
                    rule,
                    index
                  ) => {
                    const source =
                      sourceById.get(
                        rule.source_id
                      );

                    return (
                      <article
                        className="rights-topic-block"
                        key={
                          rule.id
                        }
                      >
                        <div className="rights-topic-number">
                          {index +
                            1}
                        </div>

                        <div>
                          <span className="rights-topic-eyebrow">
                            {
                              rule.rule_type
                            }
                          </span>

                          <h2>
                            {
                              rule.title
                            }
                          </h2>

                          <p>
                            {
                              rule.plain_language_text
                            }
                          </p>

                          {(rule.citation_label ||
                            rule.section_reference) && (
                            <div className="rights-source-placeholder">
                              <span className="rights-source-dot" />

                              <div>
                                <strong>
                                  {rule.citation_label ||
                                    "Verified legal source"}
                                </strong>

                                <span>
                                  {rule.section_reference
                                    ? `Reference: ${rule.section_reference}`
                                    : "Official source"}
                                </span>
                              </div>
                            </div>
                          )}

                          {source && (
                            <div className="rights-source-placeholder">
                              <span className="rights-source-dot" />

                              <div>
                                <strong>
                                  {
                                    source.title
                                  }
                                </strong>

                                <span>
                                  {
                                    source.authority
                                  }
                                </span>

                                <a
                                  href={
                                    source.official_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View official
                                  source →
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </section>

            {sources.length >
              0 && (
              <section className="rights-topic-section">
                <span className="section-label">
                  Verified sources
                </span>

                <div className="rights-topic-blocks">
                  {sources.map(
                    (
                      source,
                      index
                    ) => (
                      <article
                        className="rights-topic-block"
                        key={
                          source.id
                        }
                      >
                        <div className="rights-topic-number">
                          {index +
                            1}
                        </div>

                        <div>
                          <h2>
                            {
                              source.title
                            }
                          </h2>

                          <p>
                            {
                              source.authority
                            }
                          </p>

                          {source.version_note && (
                            <p>
                              {
                                source.version_note
                              }
                            </p>
                          )}

                          {source.last_verified_at && (
                            <p>
                              Last checked:{" "}
                              {formatVerifiedDate(
                                source.last_verified_at
                              )}
                            </p>
                          )}

                          <a
                            href={
                              source.official_url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open official
                            source →
                          </a>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </section>
            )}

            {referralRoutes.length >
              0 && (
              <section className="rights-topic-section">
                <span className="section-label">
                  Where to get help
                </span>

                <div className="rights-topic-blocks">
                  {referralRoutes.map(
                    (
                      route,
                      index
                    ) => {
                      const organisation =
                        organisationById.get(
                          route.organisation_id
                        );

                      return (
                        <article
                          className="rights-topic-block"
                          key={
                            route.id
                          }
                        >
                          <div className="rights-topic-number">
                            {index +
                              1}
                          </div>

                          <div>
                            <h2>
                              {
                                route.title
                              }
                            </h2>

                            {organisation && (
                              <p>
                                <strong>
                                  {
                                    organisation.name
                                  }
                                </strong>
                              </p>
                            )}

                            {route.instructions && (
                              <p>
                                {
                                  route.instructions
                                }
                              </p>
                            )}

                            {route.eligibility_notes && (
                              <p>
                                <strong>
                                  Check first:{" "}
                                </strong>
                                {
                                  route.eligibility_notes
                                }
                              </p>
                            )}

                            {route.urgency_note && (
                              <div className="rights-source-placeholder">
                                <span className="rights-source-dot" />

                                <div>
                                  <strong>
                                    Time-sensitive
                                    information
                                  </strong>

                                  <span>
                                    {
                                      route.urgency_note
                                    }
                                  </span>
                                </div>
                              </div>
                            )}

                            {organisation?.phone && (
                              <p>
                                Phone:{" "}
                                {
                                  organisation.phone
                                }
                              </p>
                            )}

                            {organisation?.email && (
                              <p>
                                Email:{" "}
                                {
                                  organisation.email
                                }
                              </p>
                            )}

                            {(route.official_url ||
                              organisation?.website_url) && (
                              <a
                                href={
                                  route.official_url ||
                                  organisation.website_url
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open official
                                referral
                                information →
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="rights-topic-section">
            <span className="section-label">
              Verified guidance
            </span>

            <div className="rights-topic-blocks">
              <article className="rights-topic-block">
                <div className="rights-topic-number">
                  V
                </div>

                <div>
                  <h2>
                    We're not filling
                    the gaps with
                    guesses.
                  </h2>

                  <p>
                    Detailed
                    source-backed
                    legal guidance
                    for this issue
                    has not yet been
                    published in
                    Verdict.
                  </p>

                  <p>
                    You can still
                    create a matter,
                    preserve your
                    evidence, record
                    important dates
                    and use Find Help
                    to look for
                    appropriate
                    assistance.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/help"
                      )
                    }
                  >
                    Find help →
                  </button>
                </div>
              </article>
            </div>
          </section>
        )}

        <section className="rights-topic-action-card">
          <div>
            <span>
              Have a specific
              problem?
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
              timeline in one
              place.
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

export default LegalIssue;
