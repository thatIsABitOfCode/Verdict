import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import {
  useMatter,
} from "../context/useMatter";

import "../styles/guidance.css";

function Guidance() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    searchParams,
  ] = useSearchParams();

  const {
    matter: savedMatter,
    setMatter: setSavedMatter,
  } = useMatter();

  const routeMatter =
    location.state?.matter?.id
      ? location.state.matter
      : null;

  const matterIdFromUrl =
    searchParams.get(
      "matterId"
    );

  const matterId =
    matterIdFromUrl ||
    routeMatter?.id ||
    savedMatter?.id ||
    sessionStorage.getItem(
      "verdictCurrentMatterId"
    ) ||
    null;

  const [
    matter,
    setMatter,
  ] = useState(
    routeMatter ||
    savedMatter ||
    null
  );

  const [
    guidance,
    setGuidance,
  ] = useState(null);

  const [
    evidenceCount,
    setEvidenceCount,
  ] = useState(0);

  const [
    timelineCount,
    setTimelineCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadGuidance() {
      if (
        !matterId
      ) {
        if (mounted) {
          setError(
            "No matter was selected."
          );

          setLoading(false);
        }

        return;
      }

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
          matterResult,
          evidenceResult,
          timelineResult,
        ] =
          await Promise.all([
            supabase
              .from("matters")
              .select(
                `
                  id,
                  story,
                  incident_date,
                  unsure_date,
                  involved_type,
                  involved_name,
                  status
                `
              )
              .eq(
                "id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              )
              .single(),

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
                "matter_id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              ),

            supabase
              .from(
                "timeline_events"
              )
              .select(
                "id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "matter_id",
                matterId
              )
              .eq(
                "user_id",
                user.id
              ),
          ]);

        if (
          matterResult.error
        ) {
          throw matterResult.error;
        }

        if (
          evidenceResult.error
        ) {
          throw evidenceResult.error;
        }

        if (
          timelineResult.error
        ) {
          throw timelineResult.error;
        }

        const freshMatter =
          matterResult.data;

        if (!freshMatter) {
          throw new Error(
            "Matter not found."
          );
        }

        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Your session could not be verified."
          );
        }

        const story =
          freshMatter.story?.trim();

        if (!story) {
          throw new Error(
            "Add a description of what happened before requesting guidance."
          );
        }

        const response =
          await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/legal/search`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  question:
                    story,

                  matterState: {
                    incidentDate:
                      freshMatter.incident_date ||
                      "",

                    unsureDate:
                      Boolean(
                        freshMatter.unsure_date
                      ),

                    involvedType:
                      freshMatter.involved_type ||
                      "",

                    involvedName:
                      freshMatter.involved_name ||
                      "",

                    evidenceCount:
                      evidenceResult.count ||
                      0,

                    timelineCount:
                      timelineResult.count ||
                      0,
                  },
                }),
            }
          );

        const rawText =
          await response.text();

        let result = null;

        if (rawText) {
          try {
            result =
              JSON.parse(
                rawText
              );
          } catch {
            throw new Error(
              "Verdict received an invalid response from the legal service."
            );
          }
        }

        if (!response.ok) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Verified guidance could not be loaded."
          );
        }

        if (!mounted) {
          return;
        }

        setMatter(
          freshMatter
        );

        setSavedMatter(
          (
            currentMatter
          ) => ({
            ...currentMatter,
            id:
              freshMatter.id,
            story:
              freshMatter.story ||
              "",
            date:
              freshMatter.incident_date ||
              "",
            unsureDate:
              Boolean(
                freshMatter.unsure_date
              ),
            involvedType:
              freshMatter.involved_type ||
              "",
            involvedName:
              freshMatter.involved_name ||
              "",
            status:
              freshMatter.status ||
              "in_progress",
          })
        );

        sessionStorage.setItem(
          "verdictCurrentMatterId",
          freshMatter.id
        );

        setEvidenceCount(
          evidenceResult.count ||
            0
        );

        setTimelineCount(
          timelineResult.count ||
            0
        );

        setGuidance(
          result
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load matter guidance:",
          loadError
        );

        if (mounted) {
          setError(
            loadError.message ||
              "We couldn't load verified guidance right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadGuidance();

    return () => {
      mounted = false;
    };
  }, [
    matterId,
  ]);

  function goBack() {
    navigate(
      "/matters/new/overview",
      {
        state: {
          matter:
            matter ||
            routeMatter,
        },
      }
    );
  }

  function goToEvidence() {
    navigate(
      "/matters/new/evidence",
      {
        state: {
          matter:
            matter ||
            routeMatter,
        },
      }
    );
  }

  function goToTimeline() {
    navigate(
      "/matters/new/timeline",
      {
        state: {
          matter:
            matter ||
            routeMatter,
        },
      }
    );
  }

  function goToFindHelp() {
    const selectedMatter =
      matter ||
      routeMatter ||
      savedMatter;

    const selectedMatterId =
      selectedMatter?.id ||
      matterId;

    if (selectedMatterId) {
      sessionStorage.setItem(
        "verdictCurrentMatterId",
        selectedMatterId
      );

      navigate(
        `/help?matterId=${encodeURIComponent(
          selectedMatterId
        )}`,
        {
          state: {
            matter:
              selectedMatter,
          },
        }
      );

      return;
    }

    navigate("/help");
  }

  const matches =
    Array.isArray(
      guidance?.matches
    )
      ? guidance.matches
      : [];

  const hasVerifiedCoverage =
    guidance?.coverage ===
      "verified" &&
    matches.length > 0;

  const preparationItems =
    guidance?.preparationGaps
      ?.mode ===
      "grounded_model" &&
    Array.isArray(
      guidance?.preparationGaps?.items
    )
      ? guidance.preparationGaps.items
      : [];

  return (
    <main className="guidance-page">
      <section className="guidance-shell">
        <header className="guidance-header">
          <button
            type="button"
            className="guidance-back"
            onClick={
              goBack
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="guidance-wordmark">
            VERDICT
          </span>

          <span
            className="guidance-more"
            aria-hidden="true"
          />
        </header>

        <section className="guidance-title-section">
          <span className="guidance-eyebrow">
            Verdict guidance
          </span>

          <h1>
            Understand what may
            apply.
          </h1>

          <p>
            Verdict connects the
            facts you've provided
            to verified South
            African legal
            information and
            support.
          </p>
        </section>

        {loading && (
          <article className="guidance-status-card">
            <div className="guidance-status-icon">
              V
            </div>

            <div>
              <span className="guidance-status-label">
                Checking verified
                sources
              </span>

              <h2>
                Reviewing your
                matter
              </h2>

              <p>
                Verdict is checking
                its verified legal
                knowledge for
                information that
                may be relevant to
                what you described.
              </p>
            </div>
          </article>
        )}

        {!loading &&
          error && (
            <article className="guidance-status-card">
              <div className="guidance-status-icon">
                !
              </div>

              <div>
                <span className="guidance-status-label">
                  Guidance
                  unavailable
                </span>

                <h2>
                  We couldn't
                  prepare guidance
                </h2>

                <p>
                  {error}
                </p>
              </div>
            </article>
          )}

        {!loading &&
          !error &&
          hasVerifiedCoverage && (
            <article className="guidance-status-card">
              <div className="guidance-status-icon">
                V
              </div>

              <div>
                <span className="guidance-status-label">
                  Verified
                  coverage found
                </span>

                <h2>
                  Relevant legal
                  information is
                  available
                </h2>

                <p>
                  Verdict found
                  verified legal
                  information that
                  may be relevant
                  to the facts you
                  provided. This is
                  preliminary
                  guidance, not a
                  legal
                  determination.
                </p>
              </div>
            </article>
          )}

        {!loading &&
          !error &&
          !hasVerifiedCoverage && (
            <article className="guidance-status-card">
              <div className="guidance-status-icon">
                V
              </div>

              <div>
                <span className="guidance-status-label">
                  Limited coverage
                </span>

                <h2>
                  No verified match
                  was found
                </h2>

                <p>
                  Verdict does not
                  currently have
                  enough verified
                  information to
                  give matter-specific
                  guidance here. It
                  will not invent an
                  answer.
                </p>
              </div>
            </article>
          )}

        {matter && (
          <section className="guidance-section">
            <div className="guidance-section-heading">
              <span className="section-label">
                Your matter
              </span>

              <h2>
                What Verdict
                reviewed
              </h2>
            </div>

            <div className="guidance-facts-grid">
              <article className="guidance-fact-card">
                <span>
                  Story
                </span>

                <strong>
                  {matter.story
                    ? "Provided"
                    : "Not provided"}
                </strong>
              </article>

              <article
                className="guidance-fact-card"
                onClick={
                  goToEvidence
                }
                role="button"
                tabIndex={0}
              >
                <span>
                  Evidence
                </span>

                <strong>
                  {evidenceCount}{" "}
                  {evidenceCount ===
                  1
                    ? "item"
                    : "items"}
                </strong>
              </article>

              <article
                className="guidance-fact-card"
                onClick={
                  goToTimeline
                }
                role="button"
                tabIndex={0}
              >
                <span>
                  Timeline
                </span>

                <strong>
                  {timelineCount}{" "}
                  {timelineCount ===
                  1
                    ? "event"
                    : "events"}
                </strong>
              </article>

              <article className="guidance-fact-card">
                <span>
                  Other party
                </span>

                <strong>
                  {matter.involved_name ||
                    matter.involved_type ||
                    "Not confirmed"}
                </strong>
              </article>
            </div>
          </section>
        )}

        {!loading &&
          !error &&
          hasVerifiedCoverage && (
            <section className="guidance-section">
              <div className="guidance-section-heading">
                <span className="section-label">
                  Verified guidance
                </span>

                <h2>
                  What may apply
                </h2>
              </div>

              <div className="guidance-block-list">
                {matches.map(
                  (
                    match,
                    matchIndex
                  ) => {
                    const rules =
                      Array.isArray(
                        match.rules
                      )
                        ? match.rules
                        : [];

                    const sources =
                      Array.isArray(
                        match.sources
                      )
                        ? match.sources
                        : [];

                    const referrals =
                      Array.isArray(
                        match.referrals
                      )
                        ? match.referrals
                        : [];

                    return (
                      <article
                        className="guidance-block"
                        key={
                          match.topic?.id ||
                          match.id ||
                          matchIndex
                        }
                      >
                        <div className="guidance-block-number">
                          {matchIndex +
                            1}
                        </div>

                        <div>
                          <span className="guidance-block-label">
                            Preliminary
                            match
                          </span>

                          <h3>
                            {match.topic
                              ?.title ||
                              match.topic
                                ?.name ||
                              match.issue
                                ?.name ||
                              match.domain
                                ?.name ||
                              "Relevant legal area"}
                          </h3>

                          {(match.domain
                            ?.name ||
                            match.issue
                              ?.name) && (
                            <p>
                              {[
                                match
                                  .domain
                                  ?.name,
                                match
                                  .issue
                                  ?.name,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " • "
                                )}
                            </p>
                          )}

                          {rules.length >
                            0 && (
                            <div>
                              <span className="guidance-block-label">
                                What
                                verified
                                sources
                                say
                              </span>

                              {rules.map(
                                (
                                  rule,
                                  ruleIndex
                                ) => (
                                  <div
                                    className="next-action-placeholder"
                                    key={
                                      rule.id ||
                                      ruleIndex
                                    }
                                  >
                                    <span>
                                      {String(
                                        ruleIndex +
                                          1
                                      ).padStart(
                                        2,
                                        "0"
                                      )}
                                    </span>

                                    <div>
                                      <strong>
                                        {rule.title ||
                                          "Verified legal information"}
                                      </strong>

                                      <p>
                                        {rule.plain_language ||
                                          rule.summary ||
                                          rule.content ||
                                          rule.description ||
                                          "Verified legal information is available for this issue."}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {sources.length >
                            0 && (
                            <div>
                              <span className="guidance-block-label">
                                Sources
                              </span>

                              {sources.map(
                                (
                                  source,
                                  sourceIndex
                                ) => (
                                  <div
                                    className="source-placeholder"
                                    key={
                                      source.id ||
                                      sourceIndex
                                    }
                                  >
                                    <span className="source-dot" />

                                    <div>
                                      <strong>
                                        {source.title ||
                                          source.name ||
                                          "Official source"}
                                      </strong>

                                      {source.official_url ||
                                      source.url ? (
                                        <a
                                          href={
                                            source.official_url ||
                                            source.url
                                          }
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Official
                                          source
                                          • Open
                                          original
                                        </a>
                                      ) : (
                                        <span>
                                          Verified
                                          source
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {referrals.length >
                            0 && (
                            <div>
                              <span className="guidance-block-label">
                                Where
                                you may
                                be able
                                to get
                                help
                              </span>

                              {referrals.map(
                                (
                                  referral,
                                  referralIndex
                                ) => {
                                  const organisation =
                                    referral.organisation ||
                                    referral.referral_organisation ||
                                    referral.organisation_details ||
                                    {};

                                  const referralName =
                                    organisation.name ||
                                    referral.organisation_name ||
                                    referral.title ||
                                    "Support organisation";

                                  const referralUrl =
                                    referral.official_url ||
                                    organisation.official_url ||
                                    organisation.website;

                                  return (
                                    <div
                                      className="source-placeholder"
                                      key={
                                        referral.id ||
                                        referralIndex
                                      }
                                    >
                                      <span className="source-dot" />

                                      <div>
                                        <strong>
                                          {
                                            referralName
                                          }
                                        </strong>

                                        {referral.instructions && (
                                          <span>
                                            {
                                              referral.instructions
                                            }
                                          </span>
                                        )}

                                        {referralUrl && (
                                          <a
                                            href={
                                              referralUrl
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Open
                                            official
                                            referral
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </section>
          )}

        {!loading &&
          !error &&
          hasVerifiedCoverage &&
          preparationItems.length > 0 && (
            <section className="guidance-section">
              <div className="guidance-section-heading">
                <span className="section-label">
                  Matter preparation
                </span>

                <h2>
                  What might be missing?
                </h2>

                <p>
                  These are preparation
                  suggestions based on
                  the facts you provided
                  and Verdict's verified
                  legal information.
                  They are not a finding
                  that an item is legally
                  required unless the
                  verified information
                  specifically says so.
                </p>
              </div>

              <div className="guidance-block-list">
                {preparationItems.map(
                  (
                    item,
                    itemIndex
                  ) => (
                    <article
                      className="guidance-block"
                      key={`${item.type}-${itemIndex}`}
                    >
                      <div className="guidance-block-number">
                        {String(
                          itemIndex + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div>
                        <span className="guidance-block-label">
                          {item.type ===
                          "missing_fact"
                            ? "Information to clarify"
                            : "Preparation suggestion"}
                        </span>

                        <h3>
                          {item.title}
                        </h3>

                        <p>
                          {item.reason}
                        </p>
                      </div>
                    </article>
                  )
                )}
              </div>

              <article className="guidance-safety-card">
                <strong>
                  Preparation support,
                  not a merits score.
                </strong>

                <p>
                  Verdict does not use
                  these items to predict
                  whether you will win,
                  lose or qualify for a
                  legal remedy.
                </p>
              </article>
            </section>
          )}

        <section className="guidance-section">
          <div className="guidance-section-heading">
            <span className="section-label">
              Case preparation
            </span>

            <h2>
              What you can do next
            </h2>
          </div>

          <div className="guidance-block-list">
            <article className="guidance-block">
              <div className="guidance-block-number">
                1
              </div>

              <div>
                <span className="guidance-block-label">
                  Evidence
                </span>

                <h3>
                  Review your
                  supporting
                  material
                </h3>

                <p>
                  Check that your
                  documents,
                  screenshots,
                  photographs and
                  other supporting
                  material are
                  organised and
                  relevant to what
                  happened.
                </p>

                <button
                  type="button"
                  onClick={
                    goToEvidence
                  }
                >
                  Review evidence
                  →
                </button>
              </div>
            </article>

            <article className="guidance-block">
              <div className="guidance-block-number">
                2
              </div>

              <div>
                <span className="guidance-block-label">
                  Timeline
                </span>

                <h3>
                  Check important
                  dates
                </h3>

                <p>
                  Make sure
                  important events,
                  notices,
                  communications
                  and dates are
                  recorded in the
                  correct order.
                </p>

                <button
                  type="button"
                  onClick={
                    goToTimeline
                  }
                >
                  Review timeline
                  →
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="guidance-section">
          <div className="guidance-section-heading">
            <span className="section-label">
              Human support
            </span>

            <h2>
              When you may need
              help
            </h2>
          </div>

          <article className="human-help-card">
            <div className="human-help-mark">
              →
            </div>

            <div>
              <h3>
                Get the right
                support
              </h3>

              <p>
                Find organisations
                and services that
                may be able to
                assist with your
                matter.
              </p>

              <button
                type="button"
                onClick={
                  goToFindHelp
                }
              >
                Find help
                <span>
                  →
                </span>
              </button>
            </div>
          </article>
        </section>

        <article className="guidance-safety-card">
          <strong>
            Verdict does not make
            legal decisions for
            you.
          </strong>

          <p>
            Matches shown here are
            preliminary and are
            based on the
            information you
            provided. Verified
            legal information does
            not replace advice
            from a qualified legal
            professional, and
            Verdict does not
            predict the outcome of
            your matter.
          </p>
        </article>

        <div className="guidance-bottom-action">
          <button
            type="button"
            onClick={
              goBack
            }
          >
            Back to matter
            <span>
              →
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

export default Guidance;